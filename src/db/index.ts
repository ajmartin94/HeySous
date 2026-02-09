import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { initializeFts } from "../knowledge/fts.js";
import { initializePlanning } from "../planning/history.js";
import { initializeGrocery } from "../grocery/init.js";
import { initializeReminders } from "../reminders/init.js";
import { initializeFeedback } from "../feedback/init.js";

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

  // Initialize FTS5 virtual table and sync triggers for knowledge search
  initializeFts(sqlite);

  // Initialize meal planning tables
  initializePlanning(sqlite);

  // Initialize grocery list tables
  initializeGrocery(sqlite);

  // Initialize reminder tables
  initializeReminders(sqlite);

  // Initialize feedback check-in tables
  initializeFeedback(sqlite);

  // Return Drizzle ORM instance with schema
  return drizzle(sqlite, { schema });
}
