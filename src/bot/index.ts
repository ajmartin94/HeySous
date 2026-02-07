/**
 * Bot Factory
 *
 * Creates and configures the grammY bot instance with middleware,
 * command handlers, and the async message pipeline.
 *
 * Middleware order:
 * 1. hydrateReply (parse mode support)
 * 2. autoChatAction (typing indicators)
 * 3. db injection (database context for handlers)
 * 4. startHandler (/start command)
 * 5. costsHandler (/costs admin command)
 * 6. debugHandler (/debug retrieval stats)
 * 7. preferencesHandler (/preferences user preferences)
 * 8. messageHandler (catch-all message:text -- MUST be last)
 * 9. error boundary
 */

import { Bot, type Composer } from "grammy";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import type { BotContext } from "./context.js";
import { startHandler } from "./handlers/start.js";
import { setupErrorHandler } from "./middlewares/error-handler.js";
import type { DrizzleDatabase } from "../db/index.js";

interface CreateBotOptions {
  costsHandler: Composer<BotContext>;
  debugHandler: Composer<BotContext>;
  preferencesHandler: Composer<BotContext>;
  messageHandler: Composer<BotContext>;
  db: DrizzleDatabase;
}

export function createBot(
  token: string,
  options: CreateBotOptions,
): Bot<BotContext> {
  const { costsHandler, debugHandler, preferencesHandler, messageHandler, db } = options;
  const bot = new Bot<BotContext>(token);

  // Set default parse mode for all API calls
  bot.api.config.use(parseMode("HTML"));

  // Register middleware in order
  bot.use(hydrateReply);
  bot.use(autoChatAction());

  // Inject database into context for handlers that need it
  bot.use((ctx, next) => {
    ctx.db = db;
    return next();
  });

  bot.use(startHandler);
  bot.use(costsHandler); // /costs command -- MUST be before catch-all message handler
  bot.use(debugHandler); // /debug command -- retrieval stats
  bot.use(preferencesHandler); // /preferences command -- user preferences
  bot.use(messageHandler); // catch-all message:text -- MUST be last

  // Set up error boundary
  setupErrorHandler(bot);

  return bot;
}
