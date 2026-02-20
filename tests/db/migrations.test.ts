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
