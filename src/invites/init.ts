import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize invite_tokens table via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeGrocery in grocery/init.ts.
 *
 * Must be called AFTER initializeUsers() since invite_tokens
 * references the households table.
 */
export function initializeInvites(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      household_id TEXT NOT NULL REFERENCES households(id),
      invite_type TEXT NOT NULL DEFAULT 'household'
        CHECK(invite_type IN ('household', 'independent')),
      created_by TEXT NOT NULL,
      redeemed_by TEXT,
      redeemed_at INTEGER,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);
}
