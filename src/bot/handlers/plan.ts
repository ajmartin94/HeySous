/**
 * /plan Command Handler
 *
 * Displays the current week's meal plan in a clean, minimal format.
 * No admin restriction -- any user can view their own plan.
 * No Claude API call -- instant and free.
 */

import { Composer, InlineKeyboard } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { config } from "../../config.js";
import {
  getWeekStartDate,
  DAY_NAMES,
  formatDateRange,
} from "../../planning/date-utils.js";
import { getTodayInTimezone } from "../../clock.js";
import { escapeHtml } from "../../telegram/formatter.js";

/** Raw SQLite query result shape for plan entries. */
export interface PlanRow {
  recipe_name: string;
  day_of_week: number;
  meal_type: string;
}

/**
 * Query the current week's meal plan via raw SQLite.
 * Joins meal_plans and meal_plan_entries for the current week's Monday.
 *
 * @param todayStr - Optional ISO "YYYY-MM-DD" for timezone-aware week boundary
 */
function getCurrentWeekPlan(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  todayStr?: string,
): PlanRow[] {
  const weekStart = getWeekStartDate(todayStr);

  return sqlite
    .prepare(
      `
      SELECT mpe.recipe_name, mpe.day_of_week, mpe.meal_type
      FROM meal_plans mp
      JOIN meal_plan_entries mpe ON mpe.plan_id = mp.id
      WHERE mp.household_id = ? AND mp.week_start_date = ?
      ORDER BY mpe.day_of_week ASC, mpe.meal_type ASC
      `,
    )
    .all(householdId, weekStart) as PlanRow[];
}

/**
 * Format plan entries into an HTML message for Telegram.
 *
 * Two display modes:
 * - Dinner-only: one line per day ("Monday - Chicken Parm")
 * - Multi-meal: grouped by day with meal type headers
 */
export function formatPlanMessage(entries: PlanRow[], weekStartDate: string): string {
  const isDinnerOnly = entries.every((e) => e.meal_type === "dinner");

  const lines: string[] = [
    `<b>This Week's Plan</b>`,
    `<i>${formatDateRange(weekStartDate)}</i>`,
    "",
  ];

  if (isDinnerOnly) {
    for (const entry of entries) {
      const dayName = DAY_NAMES[entry.day_of_week] ?? `Day ${entry.day_of_week}`;
      lines.push(`${dayName} - ${escapeHtml(entry.recipe_name)}`);
    }
  } else {
    // Group entries by day
    const byDay = new Map<number, PlanRow[]>();
    for (const entry of entries) {
      const existing = byDay.get(entry.day_of_week) ?? [];
      existing.push(entry);
      byDay.set(entry.day_of_week, existing);
    }

    // Render each day group
    const days = [...byDay.keys()].sort((a, b) => a - b);
    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      const dayName = DAY_NAMES[day] ?? `Day ${day}`;
      const dayEntries = byDay.get(day)!;

      if (i > 0) lines.push(""); // blank line between days
      lines.push(`<b>${dayName}</b>`);
      for (const entry of dayEntries) {
        const mealLabel =
          entry.meal_type.charAt(0).toUpperCase() + entry.meal_type.slice(1);
        lines.push(`${mealLabel} - ${escapeHtml(entry.recipe_name)}`);
      }
    }
  }

  return lines.join("\n");
}

/**
 * Create a /plan command handler with SQLite access.
 *
 * Factory pattern consistent with createPreferencesHandler, createCostsHandler, etc.
 */
export function createPlanHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const planHandler = new Composer<BotContext>();

  planHandler.command("plan", async (ctx) => {
    const householdId = ctx.householdId!;

    // Resolve user's timezone for correct week boundary
    const settingsRow = sqlite
      .prepare("SELECT timezone FROM application_settings WHERE household_id = ?")
      .get(householdId) as { timezone: string } | undefined;
    const userTimezone = settingsRow?.timezone ?? "America/New_York";
    const todayStr = getTodayInTimezone(userTimezone, { now: () => Date.now(), date: () => new Date() });

    const entries = getCurrentWeekPlan(sqlite, householdId, todayStr);

    if (entries.length === 0) {
      await ctx.reply(
        "No meal plan for this week yet! Just say something like \"plan my dinners for this week\" and we'll figure it out together.",
      );
      return;
    }

    const weekStartDate = getWeekStartDate(todayStr);
    const message = formatPlanMessage(entries, weekStartDate);

    // Build reply options with optional "View Plan" web_app button
    const replyOptions: { parse_mode: "HTML"; reply_markup?: InlineKeyboard } = {
      parse_mode: "HTML",
    };
    if (config.miniAppUrl) {
      replyOptions.reply_markup = new InlineKeyboard().webApp(
        "View Plan",
        config.miniAppUrl + "/plan",
      );
    }

    await ctx.reply(message, replyOptions);
  });

  return planHandler;
}
