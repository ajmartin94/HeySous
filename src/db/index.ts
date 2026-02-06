import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export function createDatabase(dbPath: string) {
  // Ensure the parent directory exists
  mkdirSync(dirname(dbPath), { recursive: true });

  // Create the SQLite database instance
  const sqlite = new Database(dbPath);

  // Enable WAL mode for better concurrent read/write performance
  sqlite.pragma("journal_mode = WAL");

  // Return Drizzle ORM instance with schema
  return drizzle(sqlite, { schema });
}
