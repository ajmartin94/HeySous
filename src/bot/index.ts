import { Bot } from "grammy";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import type { BotContext } from "./context.js";
import { startHandler } from "./handlers/start.js";
import { messageHandler } from "./handlers/message.js";
import { setupErrorHandler } from "./middlewares/error-handler.js";

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Set default parse mode for all API calls
  bot.api.config.use(parseMode("HTML"));

  // Register middleware in order
  bot.use(hydrateReply);
  bot.use(autoChatAction());
  bot.use(startHandler);
  bot.use(messageHandler); // MUST be after commands

  // Set up error boundary
  setupErrorHandler(bot);

  return bot;
}
