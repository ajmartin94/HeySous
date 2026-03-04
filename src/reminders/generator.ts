import type BetterSqlite3 from "better-sqlite3";
import type { createReminderRepository } from "./repository.js";
import type { createPlanRepository } from "../planning/repository.js";
import type { ReminderSettings, ReminderType } from "./types.js";
import type { Clock } from "../clock.js";
import { addDays } from "../planning/date-utils.js";
import { localTimeToUtc, getTodayInTimezone } from "../clock.js";
import { logger } from "../logger.js";

/** Default cooking time (minutes) when recipe time cannot be determined. */
const DEFAULT_COOKING_MINUTES = 45;

/**
 * Map a meal type to its configured time field from ReminderSettings.
 * Falls back to dinnerTime for unknown types (including "other").
 */
export function getMealTypeTime(settings: ReminderSettings, mealType: string): string {
  switch (mealType) {
    case "breakfast": return settings.breakfastTime;
    case "lunch": return settings.lunchTime;
    case "snack": return settings.snackTime;
    case "dinner": return settings.dinnerTime;
    case "dessert": return settings.dessertTime;
    default: return settings.dinnerTime;
  }
}

/**
 * Parse a time string like "30 minutes", "1 hour 30 minutes", "1 hr", "45 min", "1:30" into minutes.
 * Returns null if unparseable.
 */
export function parseTimeToMinutes(timeStr: string): number | null {
  const s = timeStr.trim().toLowerCase();

  // Handle "H:MM" format (e.g., "1:30")
  const colonMatch = s.match(/^(\d+):(\d+)$/);
  if (colonMatch) {
    return parseInt(colonMatch[1], 10) * 60 + parseInt(colonMatch[2], 10);
  }

  let total = 0;
  let found = false;

  // Extract hours
  const hourMatch = s.match(/(\d+)\s*(?:hours?|hrs?|h)\b/);
  if (hourMatch) {
    total += parseInt(hourMatch[1], 10) * 60;
    found = true;
  }

  // Extract minutes
  const minMatch = s.match(/(\d+)\s*(?:minutes?|mins?|m)\b/);
  if (minMatch) {
    total += parseInt(minMatch[1], 10);
    found = true;
  }

  // Handle bare number (assume minutes)
  if (!found) {
    const bareMatch = s.match(/^(\d+)$/);
    if (bareMatch) {
      total = parseInt(bareMatch[1], 10);
      found = true;
    }
  }

  return found ? total : null;
}

/**
 * Parse total recipe time (prep + cook) from recipe content text.
 * Returns total minutes, or null if no times found.
 */
export function parseRecipeTotalMinutes(content: string): number | null {
  const lines = content.split("\n");
  let prepMinutes: number | null = null;
  let cookMinutes: number | null = null;
  let totalMinutes: number | null = null;

  for (const line of lines) {
    const prepMatch = line.match(/^Prep\s*Time:\s*(.+)$/i);
    if (prepMatch) {
      prepMinutes = parseTimeToMinutes(prepMatch[1]);
    }

    const cookMatch = line.match(/^Cook\s*Time:\s*(.+)$/i);
    if (cookMatch) {
      cookMinutes = parseTimeToMinutes(cookMatch[1]);
    }

    const totalMatch = line.match(/^Total\s*Time:\s*(.+)$/i);
    if (totalMatch) {
      totalMinutes = parseTimeToMinutes(totalMatch[1]);
    }
  }

  // Prefer explicit prep + cook if both found
  if (prepMinutes !== null && cookMinutes !== null) {
    return prepMinutes + cookMinutes;
  }

  // Fall back to total time
  if (totalMinutes !== null) {
    return totalMinutes;
  }

  // If only one of prep/cook found, use it (better than nothing)
  if (prepMinutes !== null) return prepMinutes;
  if (cookMinutes !== null) return cookMinutes;

  return null;
}

/**
 * Generate reminder rows from active meal plan data.
 *
 * Creates two types of reminders:
 * 1. morning_summary -- daily overview of planned meals (or nudge if no meals).
 *    When prepAlertsEnabled, includes tomorrow's meal data so Claude can mention
 *    any advance prep (thawing, marinating, etc.) in the same message.
 * 2. start_cooking -- per-meal-type nudge to start cooking, using each type's
 *    configured time (breakfastTime, lunchTime, etc.) adjusted for recipe prep+cook time.
 *
 * On days with no meal plan, a "no_plan_nudge" morning summary is generated
 * instead of silence.
 */
export function generateReminders(deps: {
  reminderRepository: ReturnType<typeof createReminderRepository>;
  planRepository: ReturnType<typeof createPlanRepository>;
  sqlite: BetterSqlite3.Database;
  householdId: string;
  settings: ReminderSettings;
  clock: Clock;
}): void {
  const { reminderRepository, planRepository, householdId, settings, clock } = deps;

  // 1. Delete ALL reminders for this household regardless of status.
  // This ensures reminders already marked 'sent' by the poller (but not yet
  // delivered) are also removed when regenerating after a plan change.
  reminderRepository.deleteAllForRegeneration(householdId);

  // 2. Get active plans (current week + next week)
  const plans = planRepository.getActivePlans(householdId);

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
            householdId,
            "morning_summary",
            windowStart,
            windowEnd,
          )
        ) {
          if (meals && meals.length > 0) {
            // Day has meals planned
            const contextData: Record<string, unknown> = {
              date: currentDate,
              meals: meals.map((m) => ({
                mealType: m.mealType,
                recipeName: m.recipeName,
              })),
            };

            // Include tomorrow's meals for advance prep guidance
            if (settings.prepAlertsEnabled) {
              const tomorrow = addDays(currentDate, 1);
              const tomorrowMeals = dateMeals.get(tomorrow);
              if (tomorrowMeals && tomorrowMeals.length > 0) {
                contextData.tomorrowMeals = tomorrowMeals
                  .filter((m) => m.knowledgeItemId)
                  .map((m) => ({
                    mealType: m.mealType,
                    recipeName: m.recipeName,
                    knowledgeItemId: m.knowledgeItemId,
                  }));
              }
            }

            reminderRepository.createReminder({
              householdId,
              type: "morning_summary",
              dueAt,
              contextJson: JSON.stringify(contextData),
            });
          } else {
            // No meals -- nudge reminder
            reminderRepository.createReminder({
              householdId,
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

    // b. Start-cooking nudge: for each meal entry (all meal types)
    // Adjusted for total recipe prep+cook time when available
    // Fallback chain: structured metadata -> content parsing -> 45-min default
    if (meals) {
      for (const meal of meals) {
        // Calculate start time: meal type time minus recipe total time
        let recipeTotalMinutes: number | null = null;

        if (meal.knowledgeItemId && deps.sqlite) {
          try {
            // Query both content and structured time columns
            const row = deps.sqlite
              .prepare("SELECT content, prep_time_minutes, cook_time_minutes, total_time_minutes FROM knowledge_items WHERE id = ? AND household_id = ?")
              .get(meal.knowledgeItemId, householdId) as {
                content: string;
                prep_time_minutes: number | null;
                cook_time_minutes: number | null;
                total_time_minutes: number | null;
              } | undefined;

            if (row) {
              // Priority 1: Structured metadata columns
              if (row.prep_time_minutes !== null && row.cook_time_minutes !== null) {
                recipeTotalMinutes = row.prep_time_minutes + row.cook_time_minutes;
              } else if (row.total_time_minutes !== null) {
                recipeTotalMinutes = row.total_time_minutes;
              } else if (row.prep_time_minutes !== null) {
                recipeTotalMinutes = row.prep_time_minutes;
              } else if (row.cook_time_minutes !== null) {
                recipeTotalMinutes = row.cook_time_minutes;
              }

              // Priority 2: Fall back to content parsing
              if (recipeTotalMinutes === null) {
                recipeTotalMinutes = parseRecipeTotalMinutes(row.content);
              }

              // Log when neither source yields a result
              if (recipeTotalMinutes === null) {
                logger.info(
                  { householdId, recipeName: meal.recipeName, knowledgeItemId: meal.knowledgeItemId, reason: "no_time_data" },
                  "No recipe time found in content or metadata, using default fallback",
                );
              }
            } else {
              logger.info(
                { householdId, recipeName: meal.recipeName, knowledgeItemId: meal.knowledgeItemId, reason: "knowledge_item_not_found" },
                "Knowledge item not found for start-cooking reminder, using default fallback",
              );
            }
          } catch (err) {
            logger.error(
              { err, householdId, recipeName: meal.recipeName, knowledgeItemId: meal.knowledgeItemId },
              "Error querying recipe time for start-cooking reminder",
            );
          }
        } else if (!meal.knowledgeItemId) {
          logger.info(
            { householdId, recipeName: meal.recipeName, reason: "no_knowledge_item_id" },
            "No knowledge item linked to meal entry, using default fallback",
          );
        }

        // Apply time offset: use recipe total or default 45 minutes
        const offsetMinutes = recipeTotalMinutes !== null && recipeTotalMinutes > 0
          ? recipeTotalMinutes
          : DEFAULT_COOKING_MINUTES;

        const mealTime = getMealTypeTime(settings, meal.mealType);
        const [mealHours, mealMinutes] = mealTime.split(":").map(Number);
        const mealTotalMin = mealHours * 60 + mealMinutes;
        const startMin = mealTotalMin - offsetMinutes;
        const startHours = Math.floor(startMin / 60);
        const startMins = startMin % 60;
        const reminderTime = `${String(startHours).padStart(2, "0")}:${String(startMins).padStart(2, "0")}`;

        const dueAt = localTimeToUtc(
          currentDate,
          reminderTime,
          settings.timezone,
        );

        if (dueAt.getTime() > clock.now()) {
          const windowStart = new Date(dueAt.getTime() - 60_000);
          const windowEnd = new Date(dueAt.getTime() + 60_000);

          if (
            !reminderRepository.hasPendingReminder(
              householdId,
              "start_cooking",
              windowStart,
              windowEnd,
            )
          ) {
            reminderRepository.createReminder({
              householdId,
              type: "start_cooking",
              dueAt,
              contextJson: JSON.stringify({
                recipeName: meal.recipeName,
                mealType: meal.mealType,
                date: currentDate,
                knowledgeItemId: meal.knowledgeItemId,
              }),
            });
          }
        }
      }
    }

    currentDate = addDays(currentDate, 1);
  }
}
