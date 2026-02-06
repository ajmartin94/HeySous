import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { initializeFts } from "../knowledge/fts.js";

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

  // Return Drizzle ORM instance with schema
  return drizzle(sqlite, { schema });
}
