/**
 * Entry Point
 *
 * Wires all components together:
 * - Database (SQLite + Drizzle)
 * - Knowledge retrieval service (FTS5 search + token budgeting)
 * - Claude client (Anthropic SDK with tool support)
 * - Message queue (debounce batching)
 * - Pipeline processor (Claude call with tools + response + logging)
 * - Bot (grammY with handlers)
 * - Server (Express webhook) or polling mode
 */

import type BetterSqlite3 from "better-sqlite3";
import { Api } from "grammy";
import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { createServer } from "./server.js";
import { createDatabase } from "./db/index.js";
import { createClaudeClient } from "./ai/claude-client.js";
import { createMessageQueue } from "./pipeline/message-queue.js";
import { createProcessor } from "./pipeline/processor.js";
import { createMessageHandler } from "./bot/handlers/message.js";
import { createCostsHandler } from "./bot/handlers/costs.js";
import { createDebugHandler } from "./bot/handlers/debug.js";
import { createPreferencesHandler } from "./bot/handlers/preferences.js";
import { createPlanHandler } from "./bot/handlers/plan.js";
import { createGroceryHandler, createGroceryCallbackHandler } from "./bot/handlers/grocery.js";
import { createRemindersHandler } from "./bot/handlers/reminders.js";
import { createRetrievalService } from "./knowledge/retrieval.js";
import { createKnowledgeRepository } from "./knowledge/repository.js";
import { createPlanRepository } from "./planning/repository.js";
import { createGroceryRepository } from "./grocery/repository.js";
import { createReminderRepository } from "./reminders/repository.js";
import { createReminderPoller } from "./reminders/poller.js";
import { createReminderSender } from "./reminders/sender.js";
import { generateReminders } from "./reminders/generator.js";
import { createFeedbackRepository } from "./feedback/repository.js";
import { createFeedbackCallbackHandler } from "./feedback/handler.js";
import { createFeedbackTextHandler } from "./bot/handlers/feedback.js";
import { createFeedbackSender } from "./feedback/sender.js";
import { generateFeedbackCheckins } from "./feedback/generator.js";
import { createApiRouter } from "./mini-app/router.js";
import { setupMenuButton } from "./telegram/menu-button.js";
import { createAccessGate } from "./bot/middlewares/access-gate.js";
import { createStartHandler } from "./bot/handlers/start.js";
import { createInviteHandler } from "./bot/handlers/invite.js";
import { createClock, createTestClock } from "./clock.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  // Initialize clock -- test clock in dev mode for /debug time control
  const clock = config.isDev ? createTestClock() : createClock();
  if (config.isDev) {
    logger.info("Using test clock (controllable via /debug time)");
  }

  // Initialize database
  const db = createDatabase(config.dbFileName);
  logger.info({ dbFile: config.dbFileName }, "Database initialized");

  // Get raw better-sqlite3 instance for direct FTS5 access
  // Drizzle exposes the underlying driver via $client (not in public type defs)
  const sqlite = (db as unknown as { $client: BetterSqlite3.Database }).$client;

  // Get bot info for username (needed for invite deep links)
  const api = new Api(config.botToken);
  const me = await api.getMe();
  const botUsername = me.username;
  logger.info({ botUsername }, "Bot info fetched");

  // Initialize access gate and identity handlers
  const { middleware: accessGate, addToCache, refreshUserCache } = createAccessGate({ sqlite });
  const startHandler = createStartHandler({ sqlite, db, addToCache });
  const inviteHandler = createInviteHandler({ sqlite, botUsername });

  // Initialize Claude client
  const claudeClient = createClaudeClient(
    config.anthropicApiKey,
    config.anthropicModel,
  );
  logger.info({ model: config.anthropicModel }, "Claude client initialized");

  // Initialize message queue with default 1500ms debounce
  const queue = createMessageQueue();

  // Initialize knowledge retrieval service
  const retrievalService = createRetrievalService({ sqlite, db, logger });
  logger.info("Knowledge retrieval service initialized");

  // Initialize knowledge repository for write operations (recipes, preferences)
  const knowledgeRepository = createKnowledgeRepository(db);
  logger.info("Knowledge repository initialized");

  // Initialize plan repository for meal plan CRUD
  const planRepository = createPlanRepository(db);
  logger.info("Plan repository initialized");

  // Initialize grocery repository for grocery list CRUD
  const groceryRepository = createGroceryRepository(sqlite);
  logger.info("Grocery repository initialized");

  // Initialize reminder repository for reminder CRUD
  const reminderRepository = createReminderRepository(sqlite, clock);
  logger.info("Reminder repository initialized");

  // Initialize feedback repository for feedback check-in CRUD
  const feedbackRepository = createFeedbackRepository(sqlite);
  logger.info("Feedback repository initialized");

  // Helper to regenerate reminders for a given household (used by tool handler and startup)
  const regenerateReminders = (householdId: string): void => {
    const settings = reminderRepository.getOrCreateSettings(householdId);
    generateReminders({
      reminderRepository,
      planRepository,
      sqlite,
      householdId,
      settings,
      clock,
    });
    generateFeedbackCheckins({
      feedbackRepository,
      reminderRepository,
      planRepository,
      sqlite,
      householdId,
      settings,
      clock,
    });
  };

  // Create pipeline processor with knowledge augmentation
  const processBatch = createProcessor({
    claudeClient,
    db,
    logger,
    retrievalService,
    knowledgeRepository,
    planRepository,
    sqlite,
    groceryRepository,
    reminderRepository,
    generateRemindersFn: regenerateReminders,
    feedbackRepository,
    clock,
    refreshUserCache,
  });

  // Late-bound pollerTick -- set after poller is created below
  let pollerTick: (() => Promise<void>) | undefined;

  // Create handlers
  const costsHandler = createCostsHandler(db);
  const debugHandler = createDebugHandler({
    retrievalService,
    reminderRepository,
    sqlite,
    clock,
    isDev: config.isDev,
    pollerTick: async () => {
      if (pollerTick) await pollerTick();
    },
    regenerateReminders,
  });
  const preferencesHandler = createPreferencesHandler(sqlite);
  const planHandler = createPlanHandler(sqlite);
  const groceryHandler = createGroceryHandler(sqlite);
  const groceryCallbackHandler = createGroceryCallbackHandler(sqlite);
  const remindersHandler = createRemindersHandler(sqlite, clock);
  const feedbackCallbackHandler = createFeedbackCallbackHandler({ sqlite, feedbackRepository, knowledgeRepository, db, clock });
  const feedbackTextHandler = createFeedbackTextHandler({ sqlite, feedbackRepository, knowledgeRepository, db, claudeClient, clock });
  const messageHandler = createMessageHandler(queue, processBatch);

  // Create bot instance with all dependencies
  const bot = createBot(config.botToken, {
    accessGate,
    startHandler,
    inviteHandler,
    costsHandler,
    debugHandler,
    preferencesHandler,
    planHandler,
    groceryHandler,
    groceryCallbackHandler,
    feedbackCallbackHandler,
    remindersHandler,
    messageHandler,
    feedbackTextHandler,
    db,
  });

  // Configure BotFather menu button to open Mini App hub (idempotent, no-op without MINI_APP_URL)
  await setupMenuButton(bot, config.miniAppUrl);

  // Initialize reminder system BEFORE bot.start() (which blocks in polling mode)
  const reminderSender = createReminderSender({ bot: bot as Parameters<typeof createReminderSender>[0]["bot"], claudeClient, retrievalService, logger, sqlite });
  const feedbackSender = createFeedbackSender({ bot: bot as Parameters<typeof createFeedbackSender>[0]["bot"], logger, sqlite });
  const reminderPoller = createReminderPoller({ reminderRepository, sender: reminderSender, logger, feedbackSender, feedbackRepository });

  // Wire up the late-bound pollerTick for /debug tick
  pollerTick = () => reminderPoller.tick();

  // Expire old feedback check-ins on startup
  feedbackRepository.expireOldCheckins();

  // Regenerate reminders for all active chats on startup (restart-safe)
  const activeSettings = reminderRepository.getAllActiveSettings();
  for (const settings of activeSettings) {
    regenerateReminders(settings.householdId);
  }
  if (activeSettings.length > 0) {
    logger.info({ chatCount: activeSettings.length }, "Reminders regenerated for active chats on startup");
  }

  // Start poller before bot.start() (which blocks in polling mode)
  reminderPoller.start();

  // Graceful shutdown -- poller stops FIRST, then queue, then bot
  const shutdown = () => {
    logger.info("Shutting down...");
    reminderPoller.stop();
    logger.info("Reminder poller stopped");
    queue.shutdown();
    logger.info("Message queue cleared");
    bot.stop();
    logger.info("Bot stopped");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Create API router for Mini App endpoints (used in both modes)
  const apiRouter = createApiRouter({ sqlite });

  if (config.botMode === "webhook") {
    // Webhook mode (production)
    const app = createServer(bot, config.port, { apiRouter, webhookMode: true });
    app.listen(config.port, () => {
      logger.info({ port: config.port }, "Webhook server listening");
    });
    await bot.api.setWebhook(`${config.webhookUrl}/webhook/${bot.token}`);
    logger.info({ url: config.webhookUrl }, "Webhook set");
  } else {
    // Polling mode (development) -- start Express for API/Mini App access
    const app = createServer(bot, config.port, { apiRouter });
    app.listen(config.port, () => {
      logger.info({ port: config.port }, "Express server listening (polling mode)");
    });

    await bot.api.deleteWebhook();
    await bot.start({
      onStart: () => logger.info("Bot started in polling mode"),
    });
  }
}

main().catch((err) => {
  logger.error({ error: err, message: err?.message }, "Failed to start bot");
  process.exit(1);
});
