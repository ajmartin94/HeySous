/**
 * Feedback Callback Handler
 *
 * Handles inline button taps on feedback check-in messages.
 * Records sentiment and annotates recipe knowledge items with feedback.
 *
 * Follows the same factory + Composer pattern as grocery callback handler
 * (src/bot/handlers/grocery.ts).
 */

import { Composer, GrammyError } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../bot/context.js";
import type { createFeedbackRepository } from "./repository.js";
import type { createKnowledgeRepository } from "../knowledge/repository.js";
import type { FeedbackSentiment } from "./types.js";
import type { DrizzleDatabase } from "../db/index.js";
import type { Clock } from "../clock.js";
import { parseFeedbackCallback } from "./buttons.js";
import { knowledgeChangelog } from "../knowledge/schema.js";
import { formatIsoDate } from "../clock.js";

/** Map compact sentiment abbreviation to full FeedbackSentiment. */
const SENTIMENT_MAP: Record<string, FeedbackSentiment> = {
  pos: "positive",
  ok: "neutral",
  neg: "negative",
  skip: "skipped",
};

/** Confirmation messages per sentiment. */
const CONFIRMATION_MESSAGES: Record<FeedbackSentiment, string> = {
  positive: "Glad you loved it! I'll remember that.",
  neutral: "Got it, noted for next time.",
  negative: "Sorry it didn't work out. I'll keep that in mind for future suggestions.",
  skipped: "No worries! I'll note that one was skipped.",
};

interface FeedbackCallbackDeps {
  sqlite: BetterSqlite3.Database;
  feedbackRepository: ReturnType<typeof createFeedbackRepository>;
  knowledgeRepository: ReturnType<typeof createKnowledgeRepository>;
  db: DrizzleDatabase;
  clock: Clock;
}

/**
 * Append a feedback annotation to recipe knowledge item content.
 *
 * If content has a "Feedback:" section, appends to it.
 * Otherwise, adds a new "Feedback:" section.
 */
function appendFeedbackAnnotation(
  content: string,
  date: string,
  sentiment: FeedbackSentiment,
  notes: string | null,
): string {
  const annotation = notes
    ? `- ${date} [${sentiment}]: ${notes}`
    : `- ${date} [${sentiment}]: (button response, no notes)`;

  // Check if content already has a Feedback section
  const feedbackSectionIndex = content.indexOf("\nFeedback:\n");
  if (feedbackSectionIndex !== -1) {
    // Find the end of the Feedback section (next section header or end of content)
    const afterSection = content.slice(feedbackSectionIndex + "\nFeedback:\n".length);
    return content.slice(0, feedbackSectionIndex + "\nFeedback:\n".length) + afterSection + "\n" + annotation;
  }

  // Check if content starts with "Feedback:" (no leading newline)
  if (content.startsWith("Feedback:\n")) {
    return content + "\n" + annotation;
  }

  // Add new Feedback section
  return content + "\n\nFeedback:\n" + annotation;
}

/**
 * Factory function for the feedback inline button callback handler.
 *
 * Returns a Composer that handles "callback_query:data" events
 * for feedback buttons (f:{sentiment}:{reminderId} format).
 * Non-feedback callbacks pass through to other handlers via next().
 */
export function createFeedbackCallbackHandler(
  deps: FeedbackCallbackDeps,
): Composer<BotContext> {
  const { feedbackRepository, knowledgeRepository, db, clock } = deps;
  const handler = new Composer<BotContext>();

  handler.on("callback_query:data", async (ctx, next) => {
    const parsed = parseFeedbackCallback(ctx.callbackQuery.data);

    // Not a feedback callback -- pass to other handlers
    if (!parsed) {
      await next();
      return;
    }

    // Immediately clear the loading spinner
    await ctx.answerCallbackQuery();

    // Map sentiment abbreviation to full value
    const sentiment = SENTIMENT_MAP[parsed.sentiment];
    if (!sentiment) {
      await next();
      return;
    }

    // Look up the check-in by reminderId
    const checkin = feedbackRepository.getCheckinByReminderId(parsed.reminderId);
    if (!checkin) {
      try {
        await ctx.editMessageText("This check-in has expired.");
      } catch (error) {
        if (
          error instanceof GrammyError &&
          error.description.includes("message is not modified")
        ) {
          return;
        }
        throw error;
      }
      return;
    }

    // Record the response
    feedbackRepository.recordResponse(checkin.id, sentiment, null);

    // Edit message with confirmation and remove keyboard
    const confirmationText = CONFIRMATION_MESSAGES[sentiment];
    try {
      await ctx.editMessageText(confirmationText);
    } catch (error) {
      if (
        error instanceof GrammyError &&
        error.description.includes("message is not modified")
      ) {
        return;
      }
      throw error;
    }

    // For non-skipped sentiments: annotate recipe knowledge items
    if (sentiment !== "skipped") {
      try {
        const meals = JSON.parse(checkin.mealsJson) as Array<{
          mealType: string;
          recipeName: string;
          knowledgeItemId: number | null;
        }>;

        const chatId = String(ctx.chat?.id ?? checkin.chatId);
        const today = formatIsoDate(clock.date());

        for (const meal of meals) {
          if (!meal.knowledgeItemId) continue;

          const item = knowledgeRepository.getById(meal.knowledgeItemId, chatId);
          if (!item) continue;

          const updatedContent = appendFeedbackAnnotation(
            item.content,
            today,
            sentiment,
            null,
          );

          knowledgeRepository.update(meal.knowledgeItemId, chatId, {
            content: updatedContent,
          });

          db.insert(knowledgeChangelog)
            .values({
              knowledgeItemId: meal.knowledgeItemId,
              chatId,
              action: "update",
              changeDescription: "Feedback annotation added",
              previousContent: item.content,
            })
            .run();
        }
      } catch {
        // Silently ignore annotation failures -- feedback was already recorded
      }
    }
  });

  return handler;
}
