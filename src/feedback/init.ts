import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize feedback check-in tracking table via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeReminders in reminders/init.ts.
 *
 * No foreign key on reminder_id -- logs persist after deletion
 * (same rationale as knowledgeChangelog).
 */
export function initializeFeedback(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS feedback_checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      reminder_id INTEGER NOT NULL,
      meals_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'sent', 'responded', 'expired')),
      sentiment TEXT CHECK(sentiment IN ('positive', 'neutral', 'negative', 'skipped')),
      notes TEXT,
      responded_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}
