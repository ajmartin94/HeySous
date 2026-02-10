import { resolve } from "node:path";
import express, { type Express, type Router } from "express";
import { webhookCallback, type Bot } from "grammy";
import type { BotContext } from "./bot/context.js";
import { logger } from "./logger.js";

interface ServerDeps {
  apiRouter: Router;
}

export function createServer(
  bot: Bot<BotContext>,
  port: number,
  deps: ServerDeps,
): Express {
  const app = express();

  // 1. JSON body parsing
  app.use(express.json());

  // 2. Health check endpoint
  app.get("/health", (_req, res) => {
    res.send("ok");
  });

  // 3. Serve built Mini App static files at /app/*
  const miniAppDist = resolve(import.meta.dirname, "..", "mini-app", "dist");
  app.use("/app", express.static(miniAppDist));

  // 4. API routes (authenticated via initData middleware)
  app.use("/api", deps.apiRouter);

  // 5. Webhook handler -- bot.token in URL acts as a secret
  app.use(`/webhook/${bot.token}`, webhookCallback(bot, "express"));

  // 6. SPA fallback -- any /app/* request that didn't match a static file
  //    gets index.html so React Router can handle client-side routes
  app.get("/app/*splat", (_req, res) => {
    res.sendFile(resolve(miniAppDist, "index.html"));
  });

  logger.info({ port }, "Express server configured");

  return app;
}
