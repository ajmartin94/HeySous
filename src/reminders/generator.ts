import type BetterSqlite3 from "better-sqlite3";
import type { createReminderRepository } from "./repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { ReminderSettings, ReminderType } from "./types.js";
import type { Clock } from "../clock.js";
import { addDays } from "../planning/date-utils.js";
import { localTimeToUtc, getTodayInTimezone } from "../clock.js";

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
  clock: Clock;
}): void {
  const { reminderRepository, planRepository, chatId, settings, clock } = deps;

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
  const today = getTodayInTimezone(settings.timezone, clock);

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
      if (dueAt.getTime() > clock.now()) {
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

            if (dueAt.getTime() > clock.now()) {
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

          if (dueAt.getTime() > clock.now()) {
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
