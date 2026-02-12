/**
 * Help Command Handler
 *
 * /help command sends a short, friendly message pointing the user
 * to the Mini App help page for comprehensive feature coverage.
 *
 * Follows the same factory pattern as createGroceryHandler, createRemindersHandler, etc.
 */

import { Composer, InlineKeyboard } from "grammy";
import type { BotContext } from "../context.js";
import { config } from "../../config.js";

/**
 * Create a /help command handler.
 *
 * Sends a brief, warm message with a Mini App webApp button
 * linking to the help page (when miniAppUrl is configured).
 */
export function createHelpHandler(): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command("help", async (ctx) => {
    const text =
      "Here's everything I can help you with -- from saving recipes to planning meals to grocery lists and more!";

    const replyOptions: { parse_mode: "HTML"; reply_markup?: InlineKeyboard } = {
      parse_mode: "HTML",
    };

    if (config.miniAppUrl) {
      const keyboard = new InlineKeyboard().webApp(
        "Open Help",
        config.miniAppUrl + "/help",
      );
      replyOptions.reply_markup = keyboard;
    }

    await ctx.reply(text, replyOptions);
  });

  return handler;
}
