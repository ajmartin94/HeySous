import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";

/**
 * Factory function for the hub dashboard summary endpoint.
 * Returns counts for grocery items, recipes, and meal plan entries.
 *
 * Uses sqlite.prepare() pattern consistent with existing repositories
 * (grocery/repository.ts, knowledge/fts.ts).
 */
export function createSummaryRoute(sqlite: BetterSqlite3.Database) {
  return (_req: Request, res: Response) => {
    const householdId = res.locals.householdId as string;

    // Count unchecked items in active grocery list
    const groceryResult = sqlite
      .prepare(
        `SELECT COUNT(*) as count
         FROM grocery_list_items gli
         JOIN grocery_lists gl ON gli.list_id = gl.id
         WHERE gl.household_id = ? AND gl.status = 'active' AND gli.checked = 0`,
      )
      .get(householdId) as { count: number };

    // Count knowledge items tagged as 'recipe' for this household
    // (knowledge_items has no 'type' column; recipes are identified via knowledge_tags)
    const recipesResult = sqlite
      .prepare(
        `SELECT COUNT(DISTINCT ki.id) as count
         FROM knowledge_items ki
         JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
         WHERE ki.household_id = ? AND kt.tag = 'recipe'`,
      )
      .get(householdId) as { count: number };

    // Count meal plan entries for current week
    // week_start_date is the Monday of the current week in "YYYY-MM-DD" format
    const now = new Date();
    const jsDay = now.getDay();
    const daysSinceMonday = (jsDay + 6) % 7;
    const monday = new Date(now);
    monday.setDate(monday.getDate() - daysSinceMonday);
    const weekStartDate = formatIsoDate(monday);

    const plansResult = sqlite
      .prepare(
        `SELECT COUNT(*) as count
         FROM meal_plan_entries mpe
         JOIN meal_plans mp ON mpe.plan_id = mp.id
         WHERE mp.household_id = ? AND mp.week_start_date = ?`,
      )
      .get(householdId, weekStartDate) as { count: number };

    res.json({
      grocery: { uncheckedCount: groceryResult.count },
      recipes: { count: recipesResult.count },
      plans: { mealCount: plansResult.count },
    });
  };
}

/** Format a Date as "YYYY-MM-DD". */
function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
