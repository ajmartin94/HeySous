import { config } from "./config.js";
import { createBot } from "./bot/index.js";
import { createServer } from "./server.js";
import { createDatabase } from "./db/index.js";
import { logger } from "./logger.js";

async function main(): Promise<void> {
  // Initialize database (instance will be injected into handlers in later plans)
  createDatabase(config.dbFileName);
  logger.info({ dbFile: config.dbFileName }, "Database initialized");

  // Create bot instance
  const bot = createBot(config.botToken);

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
