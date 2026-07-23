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
import { SOUS_PERSONA } from "../ai/system-prompt.js";
import { buildDeepLinkKeyboard } from "../deep-links/builder.js";

/** Minimal API surface for sending a Telegram message. */
type SendMessageApi = {
  sendMessage: (
    chatId: string,
    text: string,
    options?: { parse_mode?: string; reply_markup?: unknown },
  ) => Promise<unknown>;
};

/**
 * Minimal interface for bot API -- keeps sender decoupled from grammY types.
 */
interface BotApi {
  api: SendMessageApi;
}

/**
 * True when a Telegram send failed because it could not parse the HTML entities
 * (a stray "<" or "&" in generated text or a recipe name). Detected by error
 * description rather than instanceof so mock APIs in tests can reproduce it.
 */
export function isParseEntitiesError(error: unknown): boolean {
  const e = error as { description?: unknown } | null;
  return (
    typeof e?.description === "string" &&
    e.description.includes("can't parse entities")
  );
}

/**
 * Send a Telegram message as HTML, falling back to plain text if Telegram
 * rejects the entity parsing. Mirrors the fallback in telegram/sender.ts so a
 * single stray "<"/"&" never silently drops a reminder. Non-parse errors (e.g.
 * 403 blocked) propagate to the caller unchanged.
 */
export async function sendWithHtmlFallback(
  api: SendMessageApi,
  chatId: string,
  text: string,
  extraOptions: { reply_markup?: unknown },
  logger: Logger,
  logContext: Record<string, unknown>,
): Promise<void> {
  try {
    await api.sendMessage(chatId, text, { parse_mode: "HTML", ...extraOptions });
  } catch (error: unknown) {
    if (isParseEntitiesError(error)) {
      logger.warn(
        { ...logContext, text: text.substring(0, 100) },
        "HTML parse failed, retrying message as plain text",
      );
      await api.sendMessage(chatId, text, { ...extraOptions, parse_mode: undefined });
    } else {
      throw error;
    }
  }
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

/** System prompt for reminder text generation -- uses shared Sous persona. */
const REMINDER_SYSTEM_PROMPT = `${SOUS_PERSONA}

Your current task: Generate short, warm reminder messages for Telegram.

Rules:
- Keep messages concise (2-4 sentences max)
- Be encouraging and varied -- never repeat the same phrasing
- Include relevant meal details when provided
- Match the reminder type's tone (morning = upbeat, prep = practical, cooking = energetic)`;

/** System prompt specifically for prep alert analysis -- uses shared Sous persona. */
const PREP_ALERT_SYSTEM_PROMPT = `${SOUS_PERSONA}

Your current task: Analyze this recipe and generate a prep alert for Telegram.

Your job:
1. Look at the recipe content and identify what needs advance preparation
2. Generate a short, practical reminder about what to start now
3. Focus on time-sensitive prep: marinating, thawing, soaking, slow-cooking starts, dough rising, etc.
4. If nothing needs advance prep, say so cheerfully

Rules:
- Keep it concise (2-4 sentences)
- Be specific about what to prep and roughly how long it takes`;

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
      let prompt: string;
      if (meals && meals.length > 0) {
        const mealList = meals
          .map((m) => `- ${m.mealType}: ${m.recipeName}`)
          .join("\n");
        prompt = `Generate a morning summary reminder. Today's meal plan:\n${mealList}\n\nGive a cheerful overview of the day's meals.`;
      } else {
        prompt = "Generate a morning greeting. The user has a meal plan but no specific meals are listed for today.";
      }

      // Include tomorrow's meals with advance prep guidance
      const tomorrowMeals = context.tomorrowMeals as
        | Array<{ mealType: string; recipeName: string; knowledgeItemId?: number }>
        | undefined;
      if (tomorrowMeals && tomorrowMeals.length > 0) {
        const tomorrowList = tomorrowMeals
          .map((m) => `- ${m.mealType}: ${m.recipeName}`)
          .join("\n");
        prompt += `\n\nTomorrow's meals:\n${tomorrowList}`;
        if (recipeContent) {
          prompt += `\n\nTomorrow's recipe details:\n${recipeContent}`;
        }
        prompt += `\n\nAt the end, add a brief heads-up about tomorrow's meal. If the recipe needs advance prep today (thawing frozen items, starting a marinade, soaking beans, brining, etc.), mention it specifically and practically. If nothing needs advance prep, just give a quick friendly mention of what's coming tomorrow.`;
      }

      return prompt;
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

        // 2. Fetch recipe content when needed
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
        } else if (
          reminder.type === "morning_summary" &&
          context.tomorrowMeals
        ) {
          // Fetch recipe content for tomorrow's meals so Claude can analyze advance prep
          try {
            const tomorrowMeals = context.tomorrowMeals as Array<{
              knowledgeItemId?: number;
              recipeName: string;
            }>;
            const contents: string[] = [];
            for (const meal of tomorrowMeals) {
              if (meal.knowledgeItemId) {
                const item = retrievalService.getItem(
                  meal.knowledgeItemId,
                  reminder.householdId,
                );
                if (item) {
                  contents.push(`### ${meal.recipeName}\n${item.content}`);
                }
              }
            }
            if (contents.length > 0) {
              recipeContent = contents.join("\n\n");
            }
          } catch (error) {
            logger.warn(
              { reminderId: reminder.id, error },
              "Failed to fetch recipe content for tomorrow's prep guidance",
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

        // 3b. Build deep-link keyboard for recipe-linked reminders
        let replyMarkup: unknown = undefined;
        if (context.knowledgeItemId) {
          const keyboard = buildDeepLinkKeyboard([
            { type: "recipe", recipeId: context.knowledgeItemId as number },
          ]);
          if (keyboard) {
            replyMarkup = keyboard;
          }
        }

        // 4. Send via Telegram to all household members
        const members = getHouseholdMembers(sqlite, reminder.householdId);
        let sent = false;
        for (const member of members) {
          try {
            await sendWithHtmlFallback(
              bot.api,
              member.telegramId,
              text,
              replyMarkup ? { reply_markup: replyMarkup } : {},
              logger,
              { reminderId: reminder.id, telegramId: member.telegramId },
            );
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
