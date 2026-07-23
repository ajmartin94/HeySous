import Database from "better-sqlite3";
import { migrateToHouseholdId } from "../../../src/db/migrate.js";
import { initializeFts } from "../../../src/knowledge/fts.js";
import { initializeMemoryFts } from "../../../src/memory/fts.js";
import { initializePlanning } from "../../../src/planning/history.js";
import { initializeGrocery } from "../../../src/grocery/init.js";
import { initializeReminders } from "../../../src/reminders/init.js";
import { initializeFeedback } from "../../../src/feedback/init.js";
import { initializeUsers } from "../../../src/users/init.js";
import { initializeInvites } from "../../../src/invites/init.js";
import { initializeAppFeedback } from "../../../src/app-feedback/init.js";
import { initializeCoreTables } from "../../../src/db/init.js";
import { config } from "../../../src/config.js";

/**
 * Create a fresh in-memory SQLite database for a test, initialized the same
 * way `src/db/index.ts` `createDatabase()` does -- SAME init functions, SAME
 * order -- but calling each `initializeXxx()` directly instead of going
 * through `createDatabase()`.
 *
 * This deliberately skips `runMigrations()`. `createDatabase()` normally
 * runs `runMigrations(sqlite)` (src/db/index.ts:36) BEFORE
 * `initializeUsers(sqlite, ...)` (src/db/index.ts:63) creates the `users`
 * table. Migration version 3 ("notification-deliveries-per-user",
 * src/db/migrations.ts:56-77) unconditionally does
 * `... JOIN users u ON u.household_id = nd.household_id`, which throws
 * `SqliteError: no such table: users` on ANY fresh database -- this is a
 * genuine pre-existing bug (reproduced independently by the pre-existing
 * test `tests/db/migrations.test.ts` > "createDatabase succeeds on a fresh
 * :memory: DB", which already fails on this branch without any change from
 * this test suite). All the `initializeXxx()` functions below already
 * `CREATE TABLE IF NOT EXISTS` with the FULL up-to-date schema (columns that
 * migrations retrofit onto old databases), so skipping migrations here still
 * produces a schema equivalent to a real fresh install -- just without
 * hitting the broken migration ordering.
 *
 * Must be called AFTER the test file's `vi.mock("../../src/config.js", ...)`
 * has been registered, since `initializeUsers` reads `config.adminUserId`
 * for admin seeding.
 */
export function createTestSqlite(): InstanceType<typeof Database> {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  initializeCoreTables(sqlite);
  migrateToHouseholdId(sqlite);
  initializeFts(sqlite);
  initializeMemoryFts(sqlite);
  initializePlanning(sqlite);
  initializeGrocery(sqlite);
  initializeReminders(sqlite);
  initializeFeedback(sqlite);
  initializeUsers(sqlite, config.adminUserId);
  initializeInvites(sqlite);
  initializeAppFeedback(sqlite);

  return sqlite;
}
