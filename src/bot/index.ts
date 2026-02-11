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
 * 4. accessGate (blocks unregistered users, allows /start through)
 * 5. groceryCallbackHandler (grocery inline button callbacks -- before commands)
 * 6. feedbackCallbackHandler (feedback inline button callbacks)
 * 7. startHandler (/start command -- invite deep link processing)
 * 8. inviteHandler (/invite admin command)
 * 9. costsHandler (/costs admin command)
 * 10. debugHandler (/debug retrieval stats)
 * 11. preferencesHandler (/preferences user preferences)
 * 12. planHandler (/plan meal plan display)
 * 13. groceryHandler (/grocery grocery list display)
 * 14. appFeedbackHandler (/feedback app feedback submission)
 * 15. remindersHandler (/reminders reminder settings display)
 * 16. feedbackTextHandler (free-text feedback replies -- before catch-all)
 * 17. messageHandler (catch-all message:text -- MUST be last)
 * 18. error boundary
 */

import { Bot, type Composer, type MiddlewareFn } from "grammy";
import { hydrateReply, parseMode } from "@grammyjs/parse-mode";
import { autoChatAction } from "@grammyjs/auto-chat-action";
import type { BotContext } from "./context.js";
import { setupErrorHandler } from "./middlewares/error-handler.js";
import type { DrizzleDatabase } from "../db/index.js";

interface CreateBotOptions {
  accessGate: MiddlewareFn<BotContext>;
  startHandler: Composer<BotContext>;
  inviteHandler: Composer<BotContext>;
  costsHandler: Composer<BotContext>;
  debugHandler: Composer<BotContext>;
  preferencesHandler: Composer<BotContext>;
  planHandler: Composer<BotContext>;
  groceryHandler: Composer<BotContext>;
  groceryCallbackHandler: Composer<BotContext>;
  feedbackCallbackHandler: Composer<BotContext>;
  appFeedbackHandler: Composer<BotContext>;
  remindersHandler: Composer<BotContext>;
  messageHandler: Composer<BotContext>;
  feedbackTextHandler?: Composer<BotContext>;
  db: DrizzleDatabase;
}

export function createBot(
  token: string,
  options: CreateBotOptions,
): Bot<BotContext> {
  const {
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
    appFeedbackHandler,
    remindersHandler,
    messageHandler,
    feedbackTextHandler,
    db,
  } = options;
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

  // Access gate: blocks unregistered users, allows /start through
  bot.use(accessGate);

  bot.use(groceryCallbackHandler); // grocery inline button callbacks -- must be before command handlers
  bot.use(feedbackCallbackHandler); // feedback inline button callbacks
  bot.use(startHandler); // /start command -- invite deep link processing
  bot.use(inviteHandler); // /invite command -- admin invite generation
  bot.use(costsHandler); // /costs command -- MUST be before catch-all message handler
  bot.use(debugHandler); // /debug command -- retrieval stats
  bot.use(preferencesHandler); // /preferences command -- user preferences
  bot.use(planHandler); // /plan command -- meal plan display
  bot.use(groceryHandler); // /grocery command -- grocery list display
  bot.use(appFeedbackHandler); // /feedback command -- app feedback submission
  bot.use(remindersHandler); // /reminders command -- reminder settings display
  if (feedbackTextHandler) {
    bot.use(feedbackTextHandler); // free-text feedback replies -- must be before catch-all
  }
  bot.use(messageHandler); // catch-all message:text -- MUST be last

  // Set up error boundary
  setupErrorHandler(bot);

  return bot;
}
