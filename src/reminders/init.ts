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
      household_id TEXT NOT NULL UNIQUE,
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
      household_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('morning_summary', 'prep_alert', 'start_cooking', 'feedback_checkin')),
      due_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
      context_json TEXT NOT NULL,
      generated_text TEXT,
      sent_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Migrate existing databases: recreate table with updated CHECK if needed
  // Existing CHECK constraint may block inserts of 'feedback_checkin'
  try {
    sqlite.exec(`INSERT INTO reminders (household_id, type, due_at, context_json) VALUES ('__migration_test__', 'feedback_checkin', 0, '{}')`);
    sqlite.exec(`DELETE FROM reminders WHERE household_id = '__migration_test__'`);
  } catch {
    // CHECK constraint blocks feedback_checkin -- need to recreate table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS reminders_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('morning_summary', 'prep_alert', 'start_cooking', 'feedback_checkin')),
        due_at INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'failed')),
        context_json TEXT NOT NULL,
        generated_text TEXT,
        sent_at INTEGER,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      INSERT INTO reminders_new SELECT * FROM reminders;
      DROP TABLE reminders;
      ALTER TABLE reminders_new RENAME TO reminders;
    `);
  }
}
