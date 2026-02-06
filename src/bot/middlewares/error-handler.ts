import { Bot, GrammyError, HttpError } from "grammy";
import type { BotContext } from "../context.js";
import { logger } from "../../logger.js";

export function setupErrorHandler(bot: Bot<BotContext>): void {
  bot.catch((err) => {
    const ctx = err.ctx;
    const e = err.error;

    const errorType =
      e instanceof Error ? e.constructor.name : typeof e;

    logger.error(
      { updateId: ctx.update.update_id, errorType },
      "Error while handling update"
    );

    if (e instanceof GrammyError) {
      logger.error(
        { method: e.method, description: e.description, errorCode: e.error_code },
        "Telegram API error"
      );
    } else if (e instanceof HttpError) {
      logger.error({ error: e.message }, "Network connectivity error");
    } else {
      logger.error({ error: String(e) }, "Unhandled error");
    }
  });
}
