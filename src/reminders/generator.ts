import type BetterSqlite3 from "better-sqlite3";
import type { createReminderRepository } from "./repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { ReminderSettings, ReminderType } from "./types.js";
import { addDays } from "../planning/date-utils.js";

/**
 * Convert a local time (date + "HH:MM" in a timezone) to a UTC Date.
 *
 * Uses Intl.DateTimeFormat to resolve the UTC offset for the given timezone
 * on the given date, then applies that offset to produce UTC.
 */
function localTimeToUtc(
  dateStr: string,
  time: string,
  timezone: string,
): Date {
  const [hours, minutes] = time.split(":").map(Number);

  // Build a date at the specified local time
  // We use a reference UTC date and compare with timezone-formatted output
  // to find the offset
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
  const localTarget = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`);

  // Subtract offset to get actual UTC time
  return new Date(localTarget.getTime() - offsetMs);
}

/**
 * Format a Date as "YYYY-MM-DD" ISO date string.
 */
function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

/**
 * Generate reminder rows from active meal plan data.
 *
 * Creates three types of reminders:
 * 1. morning_summary -- daily overview of planned meals (or nudge if no meals)
 * 2. prep_alert -- day-before morning alert for recipes with knowledge items
 * 3. start_cooking -- dinner-time nudge to start cooking
 *
 * On days with no meal plan, a "no_plan_nudge" morning summary is generated
 * instead of silence.
 */
export function generateReminders(deps: {
  reminderRepository: ReturnType<typeof createReminderRepository>;
  planRepository: ReturnType<typeof createPlanRepository>;
  sqlite: BetterSqlite3.Database;
  chatId: string;
  settings: ReminderSettings;
}): void {
  const { reminderRepository, planRepository, chatId, settings } = deps;

  // 1. Delete existing future pending reminders for this chat
  reminderRepository.deleteFutureReminders(chatId);

  // 2. Get active plans (current week + next week)
  const plans = planRepository.getActivePlans(chatId);

  // 3. Build a map of date -> meals from plan entries
  const dateMeals = new Map<
    string,
    Array<{
      mealType: string;
      recipeName: string;
      knowledgeItemId: number | null;
    }>
  >();

  // Track the full date range covered by active plans
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

  // 4. Generate reminders for each date in range (today through end)
  const today = getTodayInTimezone(settings.timezone);

  // Start from today or earliestDate, whichever is later
  const startDate = today > earliestDate ? today : earliestDate;
  const endDate = latestDate;

  let currentDate = startDate;
  while (currentDate <= endDate) {
    const meals = dateMeals.get(currentDate);

    // a. Morning summary (one per day)
    if (settings.morningEnabled) {
      const dueAt = localTimeToUtc(
        currentDate,
        settings.morningTime,
        settings.timezone,
      );

      // Only create if due time is in the future and no duplicate exists
      if (dueAt.getTime() > Date.now()) {
        const windowStart = new Date(dueAt.getTime() - 60_000); // 1 min window
        const windowEnd = new Date(dueAt.getTime() + 60_000);

        if (
          !reminderRepository.hasPendingReminder(
            chatId,
            "morning_summary",
            windowStart,
            windowEnd,
          )
        ) {
          if (meals && meals.length > 0) {
            // Day has meals planned
            reminderRepository.createReminder({
              chatId,
              type: "morning_summary",
              dueAt,
              contextJson: JSON.stringify({
                date: currentDate,
                meals: meals.map((m) => ({
                  mealType: m.mealType,
                  recipeName: m.recipeName,
                })),
              }),
            });
          } else {
            // No meals -- nudge reminder
            reminderRepository.createReminder({
              chatId,
              type: "morning_summary",
              dueAt,
              contextJson: JSON.stringify({
                type: "no_plan_nudge",
                date: currentDate,
              }),
            });
          }
        }
      }
    }

    // b. Prep alerts: for each recipe with a knowledgeItemId
    if (settings.prepAlertsEnabled && meals) {
      for (const meal of meals) {
        if (meal.knowledgeItemId && currentDate !== today) {
          // Prep alert fires the morning BEFORE the meal
          const prepDate = addDays(currentDate, -1);

          // Only if prep date is today or later
          if (prepDate >= today) {
            const dueAt = localTimeToUtc(
              prepDate,
              settings.morningTime,
              settings.timezone,
            );

            if (dueAt.getTime() > Date.now()) {
              const windowStart = new Date(dueAt.getTime() - 60_000);
              const windowEnd = new Date(dueAt.getTime() + 60_000);

              if (
                !reminderRepository.hasPendingReminder(
                  chatId,
                  "prep_alert",
                  windowStart,
                  windowEnd,
                )
              ) {
                reminderRepository.createReminder({
                  chatId,
                  type: "prep_alert",
                  dueAt,
                  contextJson: JSON.stringify({
                    recipeName: meal.recipeName,
                    knowledgeItemId: meal.knowledgeItemId,
                    mealDate: currentDate,
                    mealType: meal.mealType,
                  }),
                });
              }
            }
          }
        }
      }
    }

    // c. Start-cooking nudge: for each dinner entry
    if (meals) {
      for (const meal of meals) {
        if (meal.mealType === "dinner") {
          const dueAt = localTimeToUtc(
            currentDate,
            settings.dinnerTime,
            settings.timezone,
          );

          if (dueAt.getTime() > Date.now()) {
            const windowStart = new Date(dueAt.getTime() - 60_000);
            const windowEnd = new Date(dueAt.getTime() + 60_000);

            if (
              !reminderRepository.hasPendingReminder(
                chatId,
                "start_cooking",
                windowStart,
                windowEnd,
              )
            ) {
              reminderRepository.createReminder({
                chatId,
                type: "start_cooking",
                dueAt,
                contextJson: JSON.stringify({
                  recipeName: meal.recipeName,
                  date: currentDate,
                  knowledgeItemId: meal.knowledgeItemId,
                }),
              });
            }
          }
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }
}
