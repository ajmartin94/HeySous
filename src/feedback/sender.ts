import type BetterSqlite3 from "better-sqlite3";
import type { Logger } from "pino";
import type { Reminder } from "../reminders/types.js";
import type { FeedbackCheckin } from "./types.js";
import { buildFeedbackKeyboard } from "./buttons.js";
import { getHouseholdMembers } from "../users/repository.js";
import { getCheckinMessageSingle, getCheckinMessageMultiple, getCheckinMessageGeneric } from "../bot/messages.js";

/**
 * Minimal interface for bot API -- keeps sender decoupled from grammY types.
 * Same pattern as reminders/sender.ts.
 */
interface BotApi {
  api: {
    sendMessage: (
      chatId: string,
      text: string,
      options?: { parse_mode?: string; reply_markup?: unknown },
    ) => Promise<unknown>;
  };
}

export interface FeedbackSenderDeps {
  bot: BotApi;
  logger: Logger;
  sqlite: BetterSqlite3.Database;
}

/**
 * Build the check-in message text from meal context.
 *
 * Single meal: "How was the <b>Chicken Parmesan</b> tonight?"
 * Multiple meals: "How was dinner tonight? You had <b>Chicken Parm</b> and <b>Caesar Salad</b>."
 */
function buildCheckinMessage(
  meals: Array<{ mealType: string; recipeName: string }>,
): string {
  if (meals.length === 0) {
    return getCheckinMessageGeneric();
  }
  if (meals.length === 1) {
    return getCheckinMessageSingle(meals[0].recipeName);
  }
  return getCheckinMessageMultiple(meals.map((m) => m.recipeName));
}

/**
 * Factory function for sending feedback check-in messages via Telegram.
 *
 * The sender NEVER throws -- all errors are caught and logged.
 * Returns true if the message was delivered, false otherwise.
 * Same safety pattern as reminders/sender.ts.
 */
export function createFeedbackSender(deps: FeedbackSenderDeps) {
  const { bot, logger, sqlite } = deps;

  return {
    /**
     * Send a check-in message with inline sentiment buttons.
     *
     * @param reminder - The feedback_checkin reminder row
     * @param _checkin - The feedback_checkins tracking record (for future use)
     * @returns true if delivered successfully, false otherwise
     */
    async sendCheckin(
      reminder: Reminder,
      _checkin: FeedbackCheckin,
    ): Promise<boolean> {
      try {
        // 1. Parse context JSON to get meals array
        let meals: Array<{ mealType: string; recipeName: string }> = [];
        try {
          const context = JSON.parse(reminder.contextJson) as {
            date: string;
            meals: Array<{ mealType: string; recipeName: string }>;
          };
          meals = context.meals ?? [];
        } catch {
          logger.warn(
            { reminderId: reminder.id, contextJson: reminder.contextJson },
            "Failed to parse feedback check-in context JSON",
          );
        }

        // 2. Build message text
        const text = buildCheckinMessage(meals);

        // 3. Build inline keyboard
        const keyboard = buildFeedbackKeyboard(reminder.id);

        // 4. Send via Telegram to all household members
        const members = getHouseholdMembers(sqlite, reminder.householdId);
        let sent = false;
        for (const member of members) {
          try {
            await bot.api.sendMessage(member.telegramId, text, {
              parse_mode: "HTML",
              reply_markup: keyboard,
            });
            sent = true;
          } catch (error: unknown) {
            const err = error as { error_code?: number };
            if (err.error_code === 403) {
              logger.warn(
                { reminderId: reminder.id, telegramId: member.telegramId },
                "Bot blocked by user (403), skipping feedback check-in",
              );
            } else {
              logger.error(
                { reminderId: reminder.id, telegramId: member.telegramId, error },
                "Failed to send feedback check-in to member",
              );
            }
          }
        }
        if (sent) {
          logger.info(
            {
              reminderId: reminder.id,
              householdId: reminder.householdId,
              mealCount: meals.length,
              memberCount: members.length,
            },
            "Feedback check-in sent",
          );
        }
        return sent;
      } catch (error) {
        // Outermost catch -- NEVER let sender throw
        logger.error(
          { reminderId: reminder.id, error },
          "Unexpected error in sendCheckin",
        );
        return false;
      }
    },
  };
}
