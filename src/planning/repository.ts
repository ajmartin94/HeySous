import { eq, and, asc } from "drizzle-orm";
import type { DrizzleDatabase } from "../db/index.js";
import { mealPlans, mealPlanEntries } from "./schema.js";
import { getWeekStartDate, addDays } from "./date-utils.js";

/** Valid meal type values matching the schema enum. */
export type MealType = "breakfast" | "lunch" | "dinner";

/**
 * A single entry to be saved in a meal plan.
 */
export interface PlanEntry {
  day: number;
  recipeName: string;
  mealType?: MealType;
  knowledgeItemId?: number;
}

/**
 * A saved plan entry with its database ID.
 */
export interface SavedPlanEntry {
  id: number;
  dayOfWeek: number;
  mealType: string;
  recipeName: string;
  knowledgeItemId: number | null;
}

/**
 * A saved meal plan with all its entries.
 */
export interface SavedPlan {
  id: number;
  weekStartDate: string;
  entries: SavedPlanEntry[];
}

/**
 * Factory function for meal plan CRUD operations.
 * Follows the same pattern as createKnowledgeRepository.
 */
export function createPlanRepository(db: DrizzleDatabase) {
  return {
    /**
     * Save a meal plan for a specific week.
     * Find-or-create: if plan exists for this householdId + weekStartDate,
     * delete all entries and replace with new ones.
     */
    savePlan(
      householdId: string,
      weekStartDate: string,
      entries: PlanEntry[],
    ): SavedPlan {
      // Check for existing plan
      const existing = db
        .select()
        .from(mealPlans)
        .where(
          and(
            eq(mealPlans.householdId, householdId),
            eq(mealPlans.weekStartDate, weekStartDate),
          ),
        )
        .get();

      let planId: number;

      if (existing) {
        planId = existing.id;

        // Delete existing entries (will be replaced)
        db.delete(mealPlanEntries)
          .where(eq(mealPlanEntries.planId, planId))
          .run();

        // Update timestamp
        db.update(mealPlans)
          .set({ updatedAt: new Date() })
          .where(eq(mealPlans.id, planId))
          .run();
      } else {
        // Create new plan
        const inserted = db
          .insert(mealPlans)
          .values({
            householdId,
            weekStartDate,
          })
          .returning()
          .get();

        planId = inserted.id;
      }

      // Insert all entries
      const savedEntries: SavedPlanEntry[] = [];
      for (const entry of entries) {
        const inserted = db
          .insert(mealPlanEntries)
          .values({
            planId,
            dayOfWeek: entry.day,
            mealType: entry.mealType ?? "dinner",
            recipeName: entry.recipeName,
            knowledgeItemId: entry.knowledgeItemId ?? null,
          })
          .returning()
          .get();

        savedEntries.push({
          id: inserted.id,
          dayOfWeek: inserted.dayOfWeek,
          mealType: inserted.mealType,
          recipeName: inserted.recipeName,
          knowledgeItemId: inserted.knowledgeItemId,
        });
      }

      return {
        id: planId,
        weekStartDate,
        entries: savedEntries,
      };
    },

    /**
     * Get a plan for a specific week.
     * Returns null if no plan exists.
     */
    getPlan(householdId: string, weekStartDate: string): SavedPlan | null {
      const plan = db
        .select()
        .from(mealPlans)
        .where(
          and(
            eq(mealPlans.householdId, householdId),
            eq(mealPlans.weekStartDate, weekStartDate),
          ),
        )
        .get();

      if (!plan) return null;

      const entries = db
        .select()
        .from(mealPlanEntries)
        .where(eq(mealPlanEntries.planId, plan.id))
        .orderBy(asc(mealPlanEntries.dayOfWeek))
        .all();

      return {
        id: plan.id,
        weekStartDate: plan.weekStartDate,
        entries: entries.map((e) => ({
          id: e.id,
          dayOfWeek: e.dayOfWeek,
          mealType: e.mealType,
          recipeName: e.recipeName,
          knowledgeItemId: e.knowledgeItemId,
        })),
      };
    },

    /**
     * Get active plans: current week and next week (if they exist).
     */
    getActivePlans(householdId: string): SavedPlan[] {
      const currentWeek = getWeekStartDate();
      const nextWeek = addDays(currentWeek, 7);

      const plans: SavedPlan[] = [];

      const currentPlan = this.getPlan(householdId, currentWeek);
      if (currentPlan) plans.push(currentPlan);

      const nextPlan = this.getPlan(householdId, nextWeek);
      if (nextPlan) plans.push(nextPlan);

      return plans;
    },
  };
}
