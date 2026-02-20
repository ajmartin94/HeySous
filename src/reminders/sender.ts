import type BetterSqlite3 from "better-sqlite3";
import type { Logger } from "pino";
import type { Reminder, ReminderType } from "./types.js";
import { getHouseholdMembers } from "../users/repository.js";
import {
  getReminderFallbackMorning,
  getReminderFallbackPrep,
  getReminderFallbackCooking,
  getReminderFallbackCheckin,
  getReminderFallbackGeneric,
} from "../bot/messages.js";

/**
 * Minimal interface for bot API -- keeps sender decoupled from grammY types.
 */
interface BotApi {
  api: {
    sendMessage: (
      chatId: string,
      text: string,
      options?: { parse_mode?: string },
    ) => Promise<unknown>;
  };
}

/**
 * Minimal interface for Claude client -- keeps sender decoupled from full AI module.
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

/**
 * Minimal interface for knowledge retrieval -- only the getItem method.
 */
interface RetrievalService {
  getItem: (
    id: number,
    householdId: string,
  ) => { content: string; title: string } | null;
}

export interface ReminderSenderDeps {
  bot: BotApi;
  claudeClient: ClaudeClient;
  retrievalService: RetrievalService;
  logger: Logger;
  sqlite: BetterSqlite3.Database;
}

/** System prompt for reminder text generation -- focused, not the full Sous persona. */
const REMINDER_SYSTEM_PROMPT = `You are Sous, a friendly kitchen companion. Generate short, warm reminder messages for Telegram.

Rules:
- Use HTML formatting (Telegram parse mode): <b>bold</b>, <i>italic</i>
- Keep messages concise (2-4 sentences max)
- Be encouraging and varied -- never repeat the same phrasing
- Include relevant meal details when provided
- Match the reminder type's tone (morning = upbeat, prep = practical, cooking = energetic)
- Do NOT use markdown. Only HTML tags.`;

/** System prompt specifically for prep alert analysis. */
const PREP_ALERT_SYSTEM_PROMPT = `You are Sous, a friendly kitchen companion. Analyze this recipe and generate a prep alert for Telegram.

Your job:
1. Look at the recipe content and identify what needs advance preparation
2. Generate a short, practical reminder about what to start now
3. Focus on time-sensitive prep: marinating, thawing, soaking, slow-cooking starts, dough rising, etc.
4. If nothing needs advance prep, say so cheerfully

Rules:
- Use HTML formatting: <b>bold</b>, <i>italic</i>
- Keep it concise (2-4 sentences)
- Be specific about what to prep and roughly how long it takes
- Do NOT use markdown. Only HTML tags.`;

/**
 * Build a user prompt for Claude based on reminder type and context.
 */
function buildReminderPrompt(
  type: ReminderType,
  context: Record<string, unknown>,
  recipeContent?: string,
): string {
  switch (type) {
    case "morning_summary": {
      if (context.noPlanNudge) {
        return "Generate a friendly morning nudge encouraging the user to plan their meals for today. Keep it light and not pushy.";
      }
      const meals = context.meals as
        | Array<{ mealType: string; recipeName: string }>
        | undefined;
      if (meals && meals.length > 0) {
        const mealList = meals
          .map((m) => `- ${m.mealType}: ${m.recipeName}`)
          .join("\n");
        return `Generate a morning summary reminder. Today's meal plan:\n${mealList}\n\nGive a cheerful overview of the day's meals.`;
      }
      return "Generate a morning greeting. The user has a meal plan but no specific meals are listed for today.";
    }

    case "prep_alert": {
      const recipeName = (context.recipeName as string) || "the recipe";
      const mealType = (context.mealType as string) || "dinner";
      let prompt = `Generate a prep alert for ${recipeName} (${mealType}).`;
      if (recipeContent) {
        prompt += `\n\nRecipe content:\n${recipeContent}\n\nAnalyze what needs advance preparation and remind the user.`;
      } else {
        prompt += "\nNo recipe details available -- give a general prep reminder.";
      }
      return prompt;
    }

    case "start_cooking": {
      const recipeName = (context.recipeName as string) || "dinner";
      const mealType = (context.mealType as string) || "dinner";
      return `Generate a "time to start cooking" reminder for ${recipeName} (${mealType}). Be energetic and encouraging!`;
    }

    case "feedback_checkin":
      // Feedback check-ins use their own sender -- return empty if one reaches here
      return "";

    default:
      return "Generate a friendly cooking reminder.";
  }
}

/**
 * Generate plain-text fallback when Claude API fails.
 */
function getFallbackText(
  type: ReminderType,
  context: Record<string, unknown>,
): string {
  switch (type) {
    case "morning_summary":
      return getReminderFallbackMorning(
        context.meals as Array<{ mealType: string; recipeName: string }> | undefined,
        context.noPlanNudge as boolean | undefined,
      );
    case "prep_alert":
      return getReminderFallbackPrep((context.recipeName as string) || "your meal");
    case "start_cooking":
      return getReminderFallbackCooking((context.recipeName as string) || "dinner");
    case "feedback_checkin":
      return getReminderFallbackCheckin();
    default:
      return getReminderFallbackGeneric();
  }
}

/**
 * Factory function for sending reminders via Telegram with Claude-generated text.
 *
 * The sender NEVER throws -- all errors are caught and logged.
 * Returns true if the reminder was delivered, false otherwise.
 */
export function createReminderSender(deps: ReminderSenderDeps) {
  const { bot, claudeClient, retrievalService, logger, sqlite } = deps;

  return {
    /**
     * Send a single reminder to the user via Telegram.
     *
     * Flow:
     * 1. Parse context JSON
     * 2. For prep_alert: fetch recipe content from knowledge store
     * 3. Generate text via Claude (with fallback on failure)
     * 4. Send via bot.api.sendMessage
     *
     * @returns true if delivered successfully, false otherwise
     */
    async sendReminder(reminder: Reminder): Promise<boolean> {
      try {
        // 1. Parse context
        let context: Record<string, unknown> = {};
        try {
          context = JSON.parse(reminder.contextJson) as Record<string, unknown>;
        } catch {
          logger.warn(
            { reminderId: reminder.id, contextJson: reminder.contextJson },
            "Failed to parse reminder context JSON, using empty context",
          );
        }

        // 2. For prep_alert: fetch recipe content
        let recipeContent: string | undefined;
        if (
          reminder.type === "prep_alert" &&
          context.knowledgeItemId
        ) {
          try {
            const item = retrievalService.getItem(
              context.knowledgeItemId as number,
              reminder.householdId,
            );
            if (item) {
              recipeContent = item.content;
            }
          } catch (error) {
            logger.warn(
              { reminderId: reminder.id, knowledgeItemId: context.knowledgeItemId, error },
              "Failed to fetch recipe content for prep alert",
            );
          }
        }

        // 3. Generate text via Claude
        let text: string;
        try {
          const systemPrompt =
            reminder.type === "prep_alert" && recipeContent
              ? PREP_ALERT_SYSTEM_PROMPT
              : REMINDER_SYSTEM_PROMPT;

          const prompt = buildReminderPrompt(
            reminder.type,
            context,
            recipeContent,
          );

          const response = await claudeClient.sendMessage(
            [prompt],
            systemPrompt,
          );
          text = response.text;

          logger.debug(
            {
              reminderId: reminder.id,
              type: reminder.type,
              inputTokens: response.usage.inputTokens,
              outputTokens: response.usage.outputTokens,
            },
            "Claude generated reminder text",
          );
        } catch (error) {
          logger.warn(
            { reminderId: reminder.id, type: reminder.type, error },
            "Claude API failed for reminder text, using fallback",
          );
          text = getFallbackText(reminder.type, context);
        }

        // 4. Send via Telegram to all household members
        const members = getHouseholdMembers(sqlite, reminder.householdId);
        let sent = false;
        for (const member of members) {
          try {
            await bot.api.sendMessage(member.telegramId, text, {
              parse_mode: "HTML",
            });
            sent = true;
          } catch (error: unknown) {
            const err = error as { error_code?: number };
            if (err.error_code === 403) {
              logger.warn(
                { reminderId: reminder.id, telegramId: member.telegramId },
                "Bot blocked by user, skipping",
              );
            } else {
              logger.error(
                { reminderId: reminder.id, telegramId: member.telegramId, error },
                "Failed to send reminder to member",
              );
            }
          }
        }
        if (sent) {
          logger.info(
            { reminderId: reminder.id, householdId: reminder.householdId, type: reminder.type, memberCount: members.length },
            "Reminder sent successfully",
          );
        }
        return sent;
      } catch (error) {
        // Outermost catch -- NEVER let sender throw
        logger.error(
          { reminderId: reminder.id, error },
          "Unexpected error in sendReminder",
        );
        return false;
      }
    },
  };
}
