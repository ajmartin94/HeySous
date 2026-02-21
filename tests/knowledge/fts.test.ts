import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeFts, getFullItem } from "../../src/knowledge/fts.js";

vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const HOUSEHOLD_ID = "test-household";

describe("getFullItem", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    initializeFts(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns source_url for items that have one", () => {
    sqlite
      .prepare(
        "INSERT INTO knowledge_items (id, household_id, title, summary, content, source_url) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .run(
        1,
        HOUSEHOLD_ID,
        "Imported Recipe",
        "A recipe from a URL",
        "Full content...",
        "https://example.com/recipe",
      );

    const item = getFullItem(sqlite, 1, HOUSEHOLD_ID);
    expect(item).not.toBeNull();
    expect(item!.sourceUrl).toBe("https://example.com/recipe");
  });

  it("returns null sourceUrl for items without one", () => {
    sqlite
      .prepare(
        "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)",
      )
      .run(1, HOUSEHOLD_ID, "Manual Recipe", "A hand-typed recipe", "Full content...");

    const item = getFullItem(sqlite, 1, HOUSEHOLD_ID);
    expect(item).not.toBeNull();
    expect(item!.sourceUrl).toBeNull();
  });
});
