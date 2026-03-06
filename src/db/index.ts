import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { migrateToHouseholdId } from "./migrate.js";
import { initializeFts } from "../knowledge/fts.js";
import { initializeMemoryFts } from "../memory/fts.js";
import { initializePlanning } from "../planning/history.js";
import { initializeGrocery } from "../grocery/init.js";
import { initializeReminders } from "../reminders/init.js";
import { initializeFeedback } from "../feedback/init.js";
import { initializeUsers } from "../users/init.js";
import { initializeInvites } from "../invites/init.js";
import { initializeAppFeedback } from "../app-feedback/init.js";
import { initializeCoreTables } from "./init.js";
import { runMigrations } from "./migrations.js";
import { config } from "../config.js";

export type DrizzleDatabase = ReturnType<typeof createDatabase>;

export function createDatabase(dbPath: string) {
  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Create the SQLite database instance
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  sqlite.pragma("journal_mode = WAL");

  // Enable foreign keys for CASCADE deletes
  sqlite.pragma("foreign_keys = ON");

  // Run versioned migrations (after pragmas, before table init)
  runMigrations(sqlite);

  // Initialize core tables (messages, token_usage)
  initializeCoreTables(sqlite);

  // Migrate chat_id -> household_id columns (idempotent, runs before init functions)
  migrateToHouseholdId(sqlite);

  // Initialize FTS5 virtual table and sync triggers for knowledge search
  initializeFts(sqlite);

  // Initialize memory FTS5 virtual table and sync triggers
  initializeMemoryFts(sqlite);

  // Initialize meal planning tables
  initializePlanning(sqlite);

  // Initialize grocery list tables
  initializeGrocery(sqlite);

  // Initialize reminder tables
  initializeReminders(sqlite);

  // Initialize feedback check-in tables
  initializeFeedback(sqlite);

  // Initialize users and households tables (+ admin seeding)
  initializeUsers(sqlite, config.adminUserId);

  // Initialize invite tokens table (must come after users/households)
  initializeInvites(sqlite);

  // Initialize app feedback tables (feedback + proactive prompt tracking)
  initializeAppFeedback(sqlite);

  // Return Drizzle ORM instance with schema
  return drizzle(sqlite, { schema });
}
