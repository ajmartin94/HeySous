/**
 * Entry Point
 *
 * Wires all components together:
 * - Database (SQLite + Drizzle)
 * - Claude client (Anthropic SDK)
 * - Message queue (debounce batching)
 * - Pipeline processor (Claude call + response + logging)
 * - Bot (grammY with handlers)
 * - Server (Express webhook) or polling mode
 */

import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { createServer } from "./server.js";
import { createDatabase } from "./db/index.js";
import { createClaudeClient } from "./ai/claude-client.js";
import { createMessageQueue } from "./pipeline/message-queue.js";
import { createProcessor } from "./pipeline/processor.js";
import { createMessageHandler } from "./bot/handlers/message.js";
import { createCostsHandler } from "./bot/handlers/costs.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  // Initialize database
  const db = createDatabase(config.dbFileName);
  logger.info({ dbFile: config.dbFileName }, "Database initialized");

  // Initialize Claude client
  const claudeClient = createClaudeClient(
    config.anthropicApiKey,
    config.anthropicModel,
  );
  logger.info({ model: config.anthropicModel }, "Claude client initialized");

  // Initialize message queue with default 1500ms debounce
  const queue = createMessageQueue();

  // Create pipeline processor
  const processBatch = createProcessor({ claudeClient, db, logger });

  // Create handlers
  const costsHandler = createCostsHandler(db);
  const messageHandler = createMessageHandler(queue, processBatch);

  // Create bot instance with all dependencies
  const bot = createBot(config.botToken, {
    costsHandler,
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
