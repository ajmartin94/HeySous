/**
 * App Feedback Command Handler
 *
 * /feedback command lets users submit feedback about the bot experience.
 * Saves to app_feedback table with source "command".
 *
 * Follows the same factory pattern as createRemindersHandler, createGroceryHandler, etc.
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { createAppFeedbackRepository } from "../../app-feedback/repository.js";

/**
 * Create a /feedback command handler with SQLite access.
 *
 * Saves user feedback directly (no Claude API call).
 */
export function createAppFeedbackHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const repository = createAppFeedbackRepository(sqlite);
  const handler = new Composer<BotContext>();

  handler.command("feedback", async (ctx) => {
    const text = (ctx.match as string)?.trim();

    if (!text) {
      await ctx.reply("Just type /feedback followed by your thoughts!");
      return;
    }

    repository.saveFeedback({
      householdId: ctx.householdId!,
      userId: ctx.userId!,
      text,
      source: "command",
    });

    await ctx.reply("Thanks for the feedback!");
  });

  return handler;
}
