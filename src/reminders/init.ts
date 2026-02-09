import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize reminder tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeGrocery in grocery/init.ts.
 */
export function initializeReminders(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reminder_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL UNIQUE,
      timezone TEXT NOT NULL DEFAULT 'America/New_York',
      morning_time TEXT NOT NULL DEFAULT '08:00',
      dinner_time TEXT NOT NULL DEFAULT '17:30',
      morning_enabled INTEGER NOT NULL DEFAULT 1,
      prep_alerts_enabled INTEGER NOT NULL DEFAULT 1,
      muted_until INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('morning_summary', 'prep_alert', 'start_cooking')),
      due_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
      context_json TEXT NOT NULL,
      generated_text TEXT,
      sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}
