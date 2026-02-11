import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";

/**
 * Factory function for meal plan API route handlers.
 * Returns an object with getPlan handler.
 *
 * Follows the same factory pattern as createRecipeRoutes (recipes.ts).
 * All handlers expect res.locals.householdId to be set by auth middleware.
 */
export function createMealPlanRoutes(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * GET /api/meal-plan?week=current|next
     * Returns meal plan entries for the requested week with hasRecipe detection.
     * Entries are ordered by day (Monday-Sunday) then meal type (breakfast/lunch/dinner).
     */
    getPlan(req: Request, res: Response) {
      const householdId = res.locals.householdId as string;
      const week = (req.query.week as string) || "current";

      try {
        // Calculate Monday-based week start date
        const now = new Date();
        const jsDay = now.getDay(); // 0=Sunday
        const mondayOffset = (jsDay + 6) % 7; // Convert to 0=Monday
        const monday = new Date(now);
        monday.setDate(now.getDate() - mondayOffset);

        if (week === "next") {
          monday.setDate(monday.getDate() + 7);
        }

        // Format as YYYY-MM-DD with zero-padded month/day
        const yyyy = monday.getFullYear();
        const mm = String(monday.getMonth() + 1).padStart(2, "0");
        const dd = String(monday.getDate()).padStart(2, "0");
        const weekStartDate = `${yyyy}-${mm}-${dd}`;

        const rows = sqlite
          .prepare(
            `
            SELECT mpe.id, mpe.day_of_week, mpe.meal_type, mpe.recipe_name,
                   mpe.knowledge_item_id,
                   ki.id AS ki_id
            FROM meal_plan_entries mpe
            JOIN meal_plans mp ON mpe.plan_id = mp.id
            LEFT JOIN knowledge_items ki ON mpe.knowledge_item_id = ki.id
              AND ki.household_id = mp.household_id
            WHERE mp.household_id = ? AND mp.week_start_date = ?
            ORDER BY mpe.day_of_week ASC,
                     CASE mpe.meal_type WHEN 'breakfast' THEN 1 WHEN 'lunch' THEN 2 WHEN 'dinner' THEN 3 END ASC
          `
          )
          .all(householdId, weekStartDate) as Array<{
          id: number;
          day_of_week: number;
          meal_type: string;
          recipe_name: string;
          knowledge_item_id: number | null;
          ki_id: number | null;
        }>;

        const entries = rows.map((row) => ({
          id: row.id,
          dayOfWeek: row.day_of_week,
          mealType: row.meal_type,
          recipeName: row.recipe_name,
          knowledgeItemId: row.knowledge_item_id,
          hasRecipe: row.ki_id !== null,
        }));

        res.json({ weekStartDate, entries });
      } catch (err) {
        console.error("Error fetching meal plan:", err);
        res.status(500).json({ error: "Failed to fetch meal plan" });
      }
    },
  };
}
