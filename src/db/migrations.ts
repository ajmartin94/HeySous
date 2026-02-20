import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../logger.js";

export interface Migration {
  version: number;
  name: string;
  up: (sqlite: BetterSqlite3.Database) => void;
}

// Add new migrations here. Versions must be sequential integers starting at 1.
export const migrations: Migration[] = [
  {
    version: 1,
    name: "add-source-url-to-knowledge-items",
    up: (sqlite) => {
      // Check if column already exists (idempotent)
      const columns = sqlite.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
      const hasSourceUrl = columns.some((c) => c.name === "source_url");
      if (!hasSourceUrl) {
        sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN source_url TEXT");
      }
    },
  },
];

export function runMigrations(sqlite: BetterSqlite3.Database): void {
  const currentVersion = sqlite.pragma("user_version", {
    simple: true,
  }) as number;

  // Validate sequential version numbers with no gaps
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].version !== i + 1) {
      throw new Error(
        `Non-sequential migration versions: expected ${i + 1}, got ${sorted[i].version}`,
      );
    }
  }

  const pending = sorted.filter((m) => m.version > currentVersion);

  if (pending.length === 0) {
    return;
  }

  logger.info({ currentVersion, pendingCount: pending.length }, "Running database migrations");

  for (const migration of pending) {
    logger.info({ version: migration.version, name: migration.name }, "Applying migration");

    sqlite.transaction(() => {
      migration.up(sqlite);
      sqlite.pragma(`user_version = ${migration.version}`);
    })();

    logger.info({ version: migration.version, name: migration.name }, "Migration applied");
  }

  const newVersion = sqlite.pragma("user_version", { simple: true }) as number;
  logger.info({ newVersion }, "All migrations complete");
}
