import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize meal planning tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeFts in knowledge/fts.ts.
 */
export function initializePlanning(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS meal_plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
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
      chat_id TEXT NOT NULL,
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
