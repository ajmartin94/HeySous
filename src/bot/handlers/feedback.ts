/**
 * Free-Text Feedback Handler
 *
 * Detects when a user replies to a feedback check-in message with free text
 * and processes it as feedback (extracting sentiment + notes via Claude).
 *
 * Must be registered BEFORE the catch-all message handler in the bot
 * so reply-to-checkin messages are caught before normal conversation flow.
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import type { createFeedbackRepository } from "../../feedback/repository.js";
import type { createKnowledgeRepository } from "../../knowledge/repository.js";
import type { DrizzleDatabase } from "../../db/index.js";
import { extractFeedback } from "../../feedback/extractor.js";
import { knowledgeChangelog } from "../../knowledge/schema.js";
import type { FeedbackSentiment } from "../../feedback/types.js";

/**
 * Minimal Claude client interface -- same as feedback/extractor.ts.
 */
interface ClaudeClient {
  sendMessage: (
    messages: string[],
    systemPrompt?: string,
  ) => Promise<{
    text: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
    };
  }>;
}

interface FeedbackTextHandlerDeps {
  sqlite: BetterSqlite3.Database;
  feedbackRepository: ReturnType<typeof createFeedbackRepository>;
  knowledgeRepository: ReturnType<typeof createKnowledgeRepository>;
  db: DrizzleDatabase;
  claudeClient: ClaudeClient;
}

/**
 * Append a feedback annotation to recipe knowledge item content.
 */
function appendFeedbackAnnotation(
  content: string,
  date: string,
  sentiment: FeedbackSentiment,
  notes: string | null,
): string {
  const annotation = notes
    ? `- ${date} [${sentiment}]: ${notes}`
    : `- ${date} [${sentiment}]`;

  const feedbackSectionIndex = content.indexOf("\nFeedback:\n");
  if (feedbackSectionIndex !== -1) {
    return content + "\n" + annotation;
  }

  if (content.startsWith("Feedback:\n")) {
    return content + "\n" + annotation;
  }

  return content + "\n\nFeedback:\n" + annotation;
}

/**
 * Factory function for the free-text feedback handler.
 *
 * Listens for text messages that are replies to check-in messages.
 * Uses Claude to extract sentiment and notes, then records the feedback
 * and annotates recipe knowledge items.
 */
export function createFeedbackTextHandler(
  deps: FeedbackTextHandlerDeps,
): Composer<BotContext> {
  const { feedbackRepository, knowledgeRepository, db, claudeClient } = deps;
  const handler = new Composer<BotContext>();

  handler.on("message:text", async (ctx, next) => {
    // Only handle replies to existing messages
    if (!ctx.message.reply_to_message) {
      await next();
      return;
    }

    const chatId = String(ctx.chat.id);

    // Check if this is a reply to a feedback check-in message
    const pendingCheckins = feedbackRepository.getPendingSentCheckins(chatId);

    if (pendingCheckins.length === 0) {
      await next();
      return;
    }

    // Find a recent check-in (within last 24 hours)
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recentCheckin = pendingCheckins.find(
      (c) => c.createdAt.getTime() > twentyFourHoursAgo,
    );

    if (!recentCheckin) {
      await next();
      return;
    }

    // Extract feedback from the free-text response using Claude
    const { sentiment, notes } = await extractFeedback(
      ctx.message.text,
      claudeClient,
    );

    // Record the response
    feedbackRepository.recordResponse(
      recentCheckin.id,
      sentiment,
      notes || null,
    );

    // Annotate recipe knowledge items
    const today = new Date().toISOString().split("T")[0];
    try {
      const meals = JSON.parse(recentCheckin.mealsJson) as Array<{
        mealType: string;
        recipeName: string;
        knowledgeItemId: number | null;
      }>;

      for (const meal of meals) {
        if (!meal.knowledgeItemId) continue;

        const item = knowledgeRepository.getById(meal.knowledgeItemId, chatId);
        if (!item) continue;

        const updatedContent = appendFeedbackAnnotation(
          item.content,
          today,
          sentiment,
          notes || null,
        );

        knowledgeRepository.update(meal.knowledgeItemId, chatId, {
          content: updatedContent,
        });

        db.insert(knowledgeChangelog)
          .values({
            knowledgeItemId: meal.knowledgeItemId,
            chatId,
            action: "update",
            changeDescription: `Feedback annotation added: ${sentiment}${notes ? ` - ${notes}` : ""}`,
            previousContent: item.content,
          })
          .run();
      }
    } catch {
      // Silently ignore annotation failures
    }

    // Send a natural confirmation
    const confirmations: Record<string, string> = {
      positive: "Thanks for the feedback! Glad that worked out. I'll remember that for next time.",
      neutral: "Got it, thanks for letting me know. I'll keep that in mind.",
      negative: "Thanks for the honest feedback -- I'll factor that in for future suggestions.",
      skipped: "No worries, noted!",
    };

    let reply = confirmations[sentiment] ?? "Thanks for the feedback!";

    // If there are actionable notes, suggest a recipe update
    if (notes && notes.length > 0 && sentiment !== "skipped") {
      reply += ` You mentioned: "${notes}" -- want me to update the recipe based on that?`;
    }

    await ctx.reply(reply);
  });

  return handler;
}
