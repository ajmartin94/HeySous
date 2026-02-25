/**
 * Reminders Command Handler
 *
 * /reminders command shows the user's current reminder settings:
 * timezone, morning time, dinner time, toggles, and muted status.
 *
 * Follows the same factory pattern as createGroceryHandler, createPlanHandler, etc.
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import type { Clock } from "../../clock.js";
import { createReminderRepository } from "../../reminders/repository.js";

/**
 * Create a /reminders command handler with SQLite access.
 *
 * Displays the user's reminder settings instantly (no Claude API call).
 * If no settings exist, they are created with defaults on first access.
 */
export function createRemindersHandler(
  sqlite: BetterSqlite3.Database,
  clock: Clock,
): Composer<BotContext> {
  const reminderRepository = createReminderRepository(sqlite, clock);
  const handler = new Composer<BotContext>();

  handler.command("reminders", async (ctx) => {
    const householdId = ctx.householdId!;
    const settings = reminderRepository.getOrCreateSettings(householdId);

    const morningStatus = settings.morningEnabled ? "ON" : "OFF";
    const prepStatus = settings.prepAlertsEnabled ? "ON" : "OFF";

    let mutedLine = "";
    if (settings.mutedUntil && settings.mutedUntil.getTime() > clock.now()) {
      const formatted = settings.mutedUntil.toISOString().split("T")[0];
      mutedLine = `\nMuted until ${formatted}`;
    }

    const text = `<b>Reminder Settings</b>

Morning summary: ${morningStatus} (at ${settings.morningTime})
Tomorrow's prep guidance: ${prepStatus}
Dinner time: ${settings.dinnerTime}
Timezone: ${settings.timezone}${mutedLine}

<i>Tip: You can change these in conversation too -- just tell me!</i>`;

    await ctx.reply(text, { parse_mode: "HTML" });
  });

  return handler;
}
