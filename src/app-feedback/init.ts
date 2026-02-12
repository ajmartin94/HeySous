import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize app feedback tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeFeedback in feedback/init.ts.
 *
 * Creates two tables:
 * 1. app_feedback -- stores explicit, implicit, proactive, and mini-app feedback
 * 2. app_feedback_prompt_tracking -- tracks proactive prompt injection cadence
 */
export function initializeAppFeedback(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      source TEXT NOT NULL CHECK(source IN ('command', 'implicit', 'mini-app', 'proactive')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_feedback_prompt_tracking (
      household_id TEXT PRIMARY KEY,
      last_prompt_at INTEGER NOT NULL DEFAULT 0,
      messages_at_last_prompt INTEGER NOT NULL DEFAULT 0
    )
  `);
}
