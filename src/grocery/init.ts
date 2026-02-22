import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize grocery list tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializePlanning in planning/history.ts.
 */
export function initializeGrocery(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS grocery_lists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      plan_id INTEGER,
      message_id INTEGER,
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      version INTEGER NOT NULL DEFAULT 1,
      updated_by TEXT
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS grocery_list_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      list_id INTEGER NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      quantity TEXT,
      store TEXT NOT NULL,
      section TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}
