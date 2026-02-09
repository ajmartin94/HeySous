import type BetterSqlite3 from "better-sqlite3";
import type { createReminderRepository } from "../reminders/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { createFeedbackRepository } from "./repository.js";
import type { ReminderSettings } from "../reminders/types.js";
import { addDays } from "../planning/date-utils.js";

/**
 * Convert a local time (date + "HH:MM" in a timezone) to a UTC Date.
 *
 * Uses Intl.DateTimeFormat to resolve the UTC offset for the given timezone
 * on the given date, then applies that offset to produce UTC.
 *
 * Duplicated from reminders/generator.ts to keep feedback module self-contained.
 */
function localTimeToUtc(
  dateStr: string,
  time: string,
  timezone: string,
): Date {
  const [hours, minutes] = time.split(":").map(Number);

  // Build a date at the specified local time
  const refDate = new Date(`${dateStr}T${time}:00Z`);

  // Get the timezone offset by formatting the reference date in the target timezone
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(refDate);
  const getPart = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAtRef = new Date(
    Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour") === 24 ? 0 : getPart("hour"),
      getPart("minute"),
      getPart("second"),
    ),
  );

  // Offset = localAtRef - refDate (in ms)
  const offsetMs = localAtRef.getTime() - refDate.getTime();

  // The desired local time as a UTC date
  const localTarget = new Date(
    `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`,
  );

  // Subtract offset to get actual UTC time
  return new Date(localTarget.getTime() - offsetMs);
}

/**
 * Get today's date as "YYYY-MM-DD" in the user's timezone.
 */
function getTodayInTimezone(timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

/** Fixed check-in time: 8:30 PM local (midpoint of 8-9pm window). */
const CHECKIN_TIME = "20:30";

/**
 * Generate feedback_checkin reminders from active meal plan data.
 *
 * Creates one check-in per day (consolidating multiple meals) scheduled
 * for 20:30 user-local time. Each check-in gets:
 * 1. A reminder row with type "feedback_checkin"
 * 2. A feedback_checkins tracking record linked to the reminder
 *
 * Follows the same plan-iteration pattern as reminders/generator.ts
 * but simpler: one reminder type, fixed time, consolidated meals.
 */
export function generateFeedbackCheckins(deps: {
  feedbackRepository: ReturnType<typeof createFeedbackRepository>;
  reminderRepository: ReturnType<typeof createReminderRepository>;
  planRepository: ReturnType<typeof createPlanRepository>;
  sqlite: BetterSqlite3.Database;
  chatId: string;
  settings: ReminderSettings;
}): void {
  const {
    feedbackRepository,
    reminderRepository,
    planRepository,
    chatId,
    settings,
  } = deps;

  // 1. Get active plans (current week + next week)
  const plans = planRepository.getActivePlans(chatId);

  // 2. Build a map of date -> meals from plan entries
  const dateMeals = new Map<
    string,
    Array<{
      mealType: string;
      recipeName: string;
      knowledgeItemId: number | null;
    }>
  >();

  let earliestDate: string | null = null;
  let latestDate: string | null = null;

  for (const plan of plans) {
    for (const entry of plan.entries) {
      const entryDate = addDays(plan.weekStartDate, entry.dayOfWeek);

      if (!earliestDate || entryDate < earliestDate) earliestDate = entryDate;
      if (!latestDate || entryDate > latestDate) latestDate = entryDate;

      const existing = dateMeals.get(entryDate) ?? [];
      existing.push({
        mealType: entry.mealType,
        recipeName: entry.recipeName,
        knowledgeItemId: entry.knowledgeItemId,
      });
      dateMeals.set(entryDate, existing);
    }
  }

  // If no plans at all, nothing to generate
  if (!earliestDate || !latestDate) return;

  // 3. Generate one feedback_checkin per day with meals
  const today = getTodayInTimezone(settings.timezone);

  // Start from today or earliestDate, whichever is later
  const startDate = today > earliestDate ? today : earliestDate;
  const endDate = latestDate;

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const meals = dateMeals.get(currentDate);

    // Only create check-ins for dates that actually have meals
    if (meals && meals.length > 0) {
      const dueAt = localTimeToUtc(currentDate, CHECKIN_TIME, settings.timezone);

      // Only create if due time is in the future
      if (dueAt.getTime() > Date.now()) {
        // 1-minute dedup window (same pattern as reminders/generator.ts)
        const windowStart = new Date(dueAt.getTime() - 60_000);
        const windowEnd = new Date(dueAt.getTime() + 60_000);

        if (
          !reminderRepository.hasPendingReminder(
            chatId,
            "feedback_checkin",
            windowStart,
            windowEnd,
          )
        ) {
          // Build context JSON with all meals for this date
          const contextJson = JSON.stringify({
            date: currentDate,
            meals: meals.map((m) => ({
              mealType: m.mealType,
              recipeName: m.recipeName,
              knowledgeItemId: m.knowledgeItemId,
            })),
          });

          // Create the reminder
          const reminder = reminderRepository.createReminder({
            chatId,
            type: "feedback_checkin",
            dueAt,
            contextJson,
          });

          // Create the feedback_checkins tracking record
          feedbackRepository.createCheckin({
            chatId,
            reminderId: reminder.id,
            mealsJson: JSON.stringify(
              meals.map((m) => ({
                mealType: m.mealType,
                recipeName: m.recipeName,
                knowledgeItemId: m.knowledgeItemId,
              })),
            ),
          });
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }
}
