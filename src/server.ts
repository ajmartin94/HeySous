import express, { type Express } from "express";
import { webhookCallback, type Bot } from "grammy";
import type { BotContext } from "./bot/context.js";
import { logger } from "./logger.js";

export function createServer(bot: Bot<BotContext>, port: number): Express {
  const app = express();

  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.send("ok");
  });

  // Webhook handler -- bot.token in URL acts as a secret
  app.use(`/webhook/${bot.token}`, webhookCallback(bot, "express"));

  logger.info({ port }, "Express server configured");

  return app;
}
