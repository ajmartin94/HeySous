import { Bot, GrammyError, HttpError } from "grammy";
import type { BotContext } from "../context.js";
import { logger } from "../../logger.js";

/** User-facing message shown when a handler throws. Plain text -- no parse_mode. */
const GENERIC_ERROR_REPLY = "Sorry, something went wrong handling that. Please try again.";

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

    // Best-effort user-facing reply so the user isn't left with silence.
    // Wrapped in its own try/catch -- a failed reply must never throw or
    // otherwise disrupt error handling. Only reply when there's a chat to
    // reply to (some update types, e.g. channel_post edits, may lack one).
    if (ctx.chat) {
      ctx.reply(GENERIC_ERROR_REPLY, { parse_mode: undefined }).catch((replyErr) => {
        logger.error(
          { error: replyErr instanceof Error ? replyErr.message : String(replyErr) },
          "Failed to send error reply to user"
        );
      });
    }
  });
}
