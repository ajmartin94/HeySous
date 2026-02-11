import type BetterSqlite3 from "better-sqlite3";

/**
 * Initialize users and households tables via raw SQL.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 * Same pattern as initializeGrocery in grocery/init.ts.
 *
 * If adminUserId is provided and the admin does not yet exist,
 * seeds a household + admin user record so the admin is never
 * locked out by the access gate.
 */
export function initializeUsers(
  sqlite: BetterSqlite3.Database,
  adminUserId: string,
): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS households (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'My Household',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      username TEXT,
      household_id TEXT NOT NULL REFERENCES households(id),
      role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin', 'member')),
      onboarding_state TEXT NOT NULL DEFAULT 'registered'
        CHECK(onboarding_state IN ('registered', 'complete')),
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Seed admin if adminUserId is set and user doesn't exist yet
  if (adminUserId) {
    const existing = sqlite
      .prepare(`SELECT id FROM users WHERE telegram_id = ?`)
      .get(adminUserId) as { id: number } | undefined;

    if (!existing) {
      // Create household using admin's telegram_id as household_id.
      // This ensures existing chatId-based data will match when Phase 16 migrates.
      sqlite
        .prepare(
          `INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)`,
        )
        .run(adminUserId, "My Household", adminUserId);

      sqlite
        .prepare(
          `INSERT INTO users (telegram_id, display_name, household_id, role, onboarding_state)
           VALUES (?, ?, ?, 'admin', 'complete')`,
        )
        .run(adminUserId, "Admin", adminUserId);
    }

    // Verify admin exists
    const adminCount = sqlite
      .prepare(`SELECT COUNT(*) as cnt FROM users WHERE role = 'admin'`)
      .get() as { cnt: number };

    if (adminCount.cnt === 0) {
      throw new Error(
        "Admin user seeding failed: no admin user found after initialization",
      );
    }
  }
}
