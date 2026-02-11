import type BetterSqlite3 from "better-sqlite3";
import type { Clock } from "../clock.js";
import { formatIsoDate } from "../clock.js";

/**
 * Cooking history entry returned from queries.
 */
export interface CookingHistoryEntry {
  id: number;
  recipeName: string;
  knowledgeItemId: number | null;
  cookedDate: string;
  mealType: string;
  source: string;
  notes: string | null;
}

/**
 * Initialize meal planning tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeFts in knowledge/fts.ts.
 */
export function initializePlanning(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      week_start_date TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meal_plan_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plan_id INTEGER NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
      day_of_week INTEGER NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'dinner',
      recipe_name TEXT NOT NULL,
      knowledge_item_id INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS cooking_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      recipe_name TEXT NOT NULL,
      knowledge_item_id INTEGER,
      cooked_date TEXT NOT NULL,
      meal_type TEXT NOT NULL DEFAULT 'dinner',
      source TEXT NOT NULL DEFAULT 'planned',
      notes TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}

/**
 * Auto-mark past planned meals as cooked.
 * Inserts into cooking_history from meal_plan_entries where the computed
 * cooked_date is before today AND no matching entry exists yet.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param householdId - Household ID to process
 * @returns Number of meals auto-marked as cooked
 */
export function autoMarkCookedMeals(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  clock: Clock,
): number {
  const today = formatIsoDate(clock.date());

  const result = sqlite
    .prepare(
      `
      INSERT INTO cooking_history (household_id, recipe_name, knowledge_item_id, cooked_date, meal_type, source)
      SELECT
        mp.household_id,
        mpe.recipe_name,
        mpe.knowledge_item_id,
        date(mp.week_start_date, '+' || mpe.day_of_week || ' days') AS cooked_date,
        mpe.meal_type,
        'planned'
      FROM meal_plan_entries mpe
      JOIN meal_plans mp ON mp.id = mpe.plan_id
      WHERE mp.household_id = ?
        AND date(mp.week_start_date, '+' || mpe.day_of_week || ' days') < ?
        AND NOT EXISTS (
          SELECT 1 FROM cooking_history ch
          WHERE ch.household_id = mp.household_id
            AND ch.recipe_name = mpe.recipe_name
            AND ch.cooked_date = date(mp.week_start_date, '+' || mpe.day_of_week || ' days')
            AND ch.meal_type = mpe.meal_type
        )
      `,
    )
    .run(householdId, today);

  return result.changes;
}

/**
 * Log a single meal to cooking history.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param params - Meal details
 */
export function logMeal(
  sqlite: BetterSqlite3.Database,
  params: {
    householdId: string;
    recipeName: string;
    cookedDate: string;
    mealType?: string;
    knowledgeItemId?: number;
    notes?: string;
    source?: string;
  },
): void {
  sqlite
    .prepare(
      `
      INSERT INTO cooking_history (household_id, recipe_name, knowledge_item_id, cooked_date, meal_type, source, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      params.householdId,
      params.recipeName,
      params.knowledgeItemId ?? null,
      params.cookedDate,
      params.mealType ?? "dinner",
      params.source ?? "unplanned",
      params.notes ?? null,
    );
}

/**
 * Query cooking history for a chat within a date range.
 * Defaults to last 3 weeks (21 days) if no dates provided.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param householdId - Household ID for per-household isolation
 * @param startDate - Optional ISO date string for range start
 * @param endDate - Optional ISO date string for range end
 * @returns Array of cooking history entries sorted by cookedDate desc
 */
export function getCookingHistory(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  clock: Clock,
  startDate?: string,
  endDate?: string,
): CookingHistoryEntry[] {
  // Default to last 21 days if no range provided
  const end = endDate ?? formatIsoDate(clock.date());
  const start =
    startDate ??
    (() => {
      const d = clock.date();
      d.setDate(d.getDate() - 21);
      return formatIsoDate(d);
    })();

  const rows = sqlite
    .prepare(
      `
      SELECT id, recipe_name, knowledge_item_id, cooked_date, meal_type, source, notes
      FROM cooking_history
      WHERE household_id = ?
        AND cooked_date >= ?
        AND cooked_date <= ?
      ORDER BY cooked_date DESC
      `,
    )
    .all(householdId, start, end) as Array<{
    id: number;
    recipe_name: string;
    knowledge_item_id: number | null;
    cooked_date: string;
    meal_type: string;
    source: string;
    notes: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    recipeName: row.recipe_name,
    knowledgeItemId: row.knowledge_item_id,
    cookedDate: row.cooked_date,
    mealType: row.meal_type,
    source: row.source,
    notes: row.notes,
  }));
}
