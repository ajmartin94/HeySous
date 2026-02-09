import type BetterSqlite3 from "better-sqlite3";
import type { createReminderRepository } from "../reminders/repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { createFeedbackRepository } from "./repository.js";
import type { ReminderSettings } from "../reminders/types.js";
import type { Clock } from "../clock.js";
import { addDays } from "../planning/date-utils.js";
import { localTimeToUtc, getTodayInTimezone } from "../clock.js";

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
  clock: Clock;
}): void {
  const {
    feedbackRepository,
    reminderRepository,
    planRepository,
    chatId,
    settings,
    clock,
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
  const today = getTodayInTimezone(settings.timezone, clock);

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
      if (dueAt.getTime() > clock.now()) {
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
