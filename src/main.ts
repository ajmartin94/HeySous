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
import { createRetrievalService } from "./knowledge/retrieval.js";
import { createKnowledgeRepository } from "./knowledge/repository.js";
import { createPlanRepository } from "./planning/repository.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  // Initialize database
  const db = createDatabase(config.dbFileName);
  logger.info({ dbFile: config.dbFileName }, "Database initialized");

  // Get raw better-sqlite3 instance for direct FTS5 access
  // Drizzle exposes the underlying driver via $client (not in public type defs)
  const sqlite = (db as unknown as { $client: BetterSqlite3.Database }).$client;

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

  // Create pipeline processor with knowledge augmentation
  const processBatch = createProcessor({
    claudeClient,
    db,
    logger,
    retrievalService,
    knowledgeRepository,
    planRepository,
    sqlite,
  });

  // Create handlers
  const costsHandler = createCostsHandler(db);
  const debugHandler = createDebugHandler(retrievalService);
  const preferencesHandler = createPreferencesHandler(sqlite);
  const planHandler = createPlanHandler(sqlite);
  const messageHandler = createMessageHandler(queue, processBatch);

  // Create bot instance with all dependencies
  const bot = createBot(config.botToken, {
    costsHandler,
    debugHandler,
    preferencesHandler,
    planHandler,
    messageHandler,
    db,
  });

  if (config.botMode === "webhook") {
    // Webhook mode (production)
    const app = createServer(bot, config.port);
    app.listen(config.port, () => {
      logger.info({ port: config.port }, "Webhook server listening");
    });
    await bot.api.setWebhook(`${config.webhookUrl}/webhook/${bot.token}`);
    logger.info({ url: config.webhookUrl }, "Webhook set");
  } else {
    // Polling mode (development)
    await bot.api.deleteWebhook();
    await bot.start({
      onStart: () => logger.info("Bot started in polling mode"),
    });
  }

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    queue.shutdown();
    logger.info("Message queue cleared");
    bot.stop();
    logger.info("Bot stopped");
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  logger.error({ error: err }, "Failed to start bot");
  process.exit(1);
});
