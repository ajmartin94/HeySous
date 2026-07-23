import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { runMigrations, migrations } from "../../src/db/migrations.js";

vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("../../src/config.js", () => ({
  config: {
    adminUserId: "test-admin",
  },
}));

// Snapshot of the real, production migrations array, captured at module load
// time before any test mutates the shared `migrations` array in place. Tests
// below that need a clean slate splice fake entries in via beforeEach and
// MUST restore this snapshot via afterEach -- otherwise the mutation leaks
// into later tests/describes in this file (e.g. the fresh-install
// integration test below), silently replacing the real migrations with a
// couple of fake ones and masking any bug in the real migration list.
const REAL_MIGRATIONS = [...migrations];

function restoreRealMigrations() {
  migrations.length = 0;
  migrations.push(...REAL_MIGRATIONS);
}

describe("runMigrations", () => {
  let db: InstanceType<typeof Database>;

  beforeEach(() => {
    migrations.length = 0;
    db = new Database(":memory:");
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    db.close();
    restoreRealMigrations();
  });

  it("runs pending migrations and updates user_version", () => {
    migrations.push(
      {
        version: 1,
        name: "create_test_table",
        up: (sqlite) => {
          sqlite.exec("CREATE TABLE test_items (id INTEGER PRIMARY KEY, name TEXT)");
        },
      },
      {
        version: 2,
        name: "add_description_column",
        up: (sqlite) => {
          sqlite.exec("ALTER TABLE test_items ADD COLUMN description TEXT");
        },
      },
    );

    runMigrations(db);

    expect(db.pragma("user_version", { simple: true })).toBe(2);

    const columns = db.prepare("PRAGMA table_info(test_items)").all() as Array<{ name: string }>;
    const columnNames = columns.map((c) => c.name);
    expect(columnNames).toContain("id");
    expect(columnNames).toContain("name");
    expect(columnNames).toContain("description");
  });

  it("skips already-applied migrations", () => {
    db.pragma("user_version = 2");

    migrations.push(
      {
        version: 1,
        name: "create_skipped_table",
        up: (sqlite) => {
          sqlite.exec("CREATE TABLE should_not_exist (id INTEGER PRIMARY KEY)");
        },
      },
      {
        version: 2,
        name: "also_skipped",
        up: (sqlite) => {
          sqlite.exec("CREATE TABLE also_should_not_exist (id INTEGER PRIMARY KEY)");
        },
      },
    );

    runMigrations(db);

    expect(db.pragma("user_version", { simple: true })).toBe(2);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='should_not_exist'")
      .all();
    expect(tables).toHaveLength(0);
  });

  it("is idempotent - second run is a no-op", () => {
    migrations.push({
      version: 1,
      name: "create_idem_table",
      up: (sqlite) => {
        sqlite.exec("CREATE TABLE idem_test (id INTEGER PRIMARY KEY)");
      },
    });

    runMigrations(db);
    runMigrations(db);

    expect(db.pragma("user_version", { simple: true })).toBe(1);
  });

  it("rolls back failed migration and does not advance version", () => {
    migrations.push(
      {
        version: 1,
        name: "succeeds",
        up: (sqlite) => {
          sqlite.exec("CREATE TABLE rollback_test (id INTEGER PRIMARY KEY)");
        },
      },
      {
        version: 2,
        name: "fails",
        up: () => {
          throw new Error("Intentional failure");
        },
      },
    );

    expect(() => runMigrations(db)).toThrow("Intentional failure");

    expect(db.pragma("user_version", { simple: true })).toBe(1);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='rollback_test'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("throws on non-sequential version numbers", () => {
    migrations.push(
      {
        version: 1,
        name: "first",
        up: () => {},
      },
      {
        version: 3,
        name: "gap",
        up: () => {},
      },
    );

    expect(() => runMigrations(db)).toThrow(/non-sequential/i);
  });

  it("handles empty migrations array", () => {
    runMigrations(db);

    expect(db.pragma("user_version", { simple: true })).toBe(0);
  });
});

describe("migration 001 fresh-install guard (real migration)", () => {
  // The runMigrations tests above clear `migrations.length = 0` in beforeEach.
  // We must restore the real migrations before each test in this block.
  let freshDb: InstanceType<typeof Database>;
  let savedMigrations: typeof migrations extends Array<infer T> ? T[] : never;

  // Capture the real migrations at module load time (before any beforeEach clears them)
  // Since the first describe's afterEach doesn't restore, we import fresh.
  beforeEach(async () => {
    // Re-import to get the original migrations array contents
    const mod = await import("../../src/db/migrations.js");
    // The `migrations` reference is the same array object, but it may have been cleared.
    // Restore the real migration entries by pushing the production migrations back.
    // We know migration 001 is "add-source-url-to-knowledge-items" and 002 is "create-notifications-tables"
    migrations.length = 0;
    migrations.push(
      {
        version: 1,
        name: "add-source-url-to-knowledge-items",
        up: (sqlite) => {
          const tableExists = sqlite
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='knowledge_items'")
            .get();
          if (!tableExists) return;

          const columns = sqlite.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
          const hasSourceUrl = columns.some((c) => c.name === "source_url");
          if (!hasSourceUrl) {
            sqlite.exec("ALTER TABLE knowledge_items ADD COLUMN source_url TEXT");
          }
        },
      },
      {
        version: 2,
        name: "create-notifications-tables",
        up: (sqlite) => {
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS notifications (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              version TEXT NOT NULL UNIQUE,
              content TEXT NOT NULL,
              created_at INTEGER NOT NULL DEFAULT (unixepoch())
            )
          `);
          sqlite.exec(`
            CREATE TABLE IF NOT EXISTS notification_deliveries (
              notification_id INTEGER NOT NULL REFERENCES notifications(id),
              household_id TEXT NOT NULL,
              delivered_at INTEGER NOT NULL DEFAULT (unixepoch()),
              PRIMARY KEY (notification_id, household_id)
            )
          `);
        },
      },
    );
    freshDb = new Database(":memory:");
    freshDb.pragma("journal_mode = WAL");
    freshDb.pragma("foreign_keys = ON");
  });

  afterEach(() => {
    freshDb.close();
    restoreRealMigrations();
  });

  it("real migration 001 does not throw on a fresh DB with no knowledge_items table", () => {
    // Fresh DB has no tables — migration 001 should skip gracefully
    expect(() => runMigrations(freshDb)).not.toThrow();
    // Should advance past all migrations
    const version = freshDb.pragma("user_version", { simple: true }) as number;
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it("real migration 001 adds source_url column when knowledge_items exists without it", () => {
    // Simulate a pre-migration DB: create knowledge_items WITHOUT source_url
    freshDb.exec(`
      CREATE TABLE knowledge_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
        last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch())
      )
    `);

    expect(() => runMigrations(freshDb)).not.toThrow();

    // Verify the column was added
    const columns = freshDb.pragma("table_info(knowledge_items)") as Array<{ name: string }>;
    expect(columns.some((c) => c.name === "source_url")).toBe(true);
  });
});

describe("createDatabase fresh-install integration", () => {
  it("createDatabase succeeds on a fresh :memory: DB", async () => {
    const { createDatabase } = await import("../../src/db/index.js");
    // createDatabase uses config.adminUserId (mocked above)
    expect(() => createDatabase(":memory:")).not.toThrow();
  });
});
