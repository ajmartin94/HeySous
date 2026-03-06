import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import Database from "better-sqlite3";
import { initializeFts, getFullItem, computeContentSimilarity } from "../../src/knowledge/fts.js";

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

describe("computeContentSimilarity", () => {
  it("returns 0.50 for short preferences differing by one word", () => {
    // "Breakfast Time: 7am" -> tokens: {"breakfast", "time:", "7am"}
    // "Breakfast Time: 8am" -> tokens: {"breakfast", "time:", "8am"}
    // Intersection: 2 (breakfast, time:), Union: 4 -> 2/4 = 0.50
    const similarity = computeContentSimilarity(
      "Breakfast Time: 7am",
      "Breakfast Time: 8am",
    );
    expect(similarity).toBeCloseTo(0.50, 2);
  });

  it("catches near-identical preferences with realistic content length", () => {
    // Real preference content is longer than just the title -- more shared words
    // means higher similarity that exceeds the 0.70 threshold
    const similarity = computeContentSimilarity(
      "Preferred breakfast time is 7am. We like to eat early before work.",
      "Preferred breakfast time is 8am. We like to eat early before work.",
    );
    // Most words shared, only "7am" vs "8am" differs
    expect(similarity).toBeGreaterThan(0.70);
  });

  it("returns low similarity for unrelated preferences", () => {
    const similarity = computeContentSimilarity(
      "Breakfast Time: 7am",
      "Dinner preference: spicy food",
    );
    expect(similarity).toBeLessThan(0.50);
  });

  it("returns high similarity for nearly identical text", () => {
    // "Likes spicy food" -> {"likes", "spicy", "food"} (3 words, "a" is stop word)
    // "Likes spicy food a lot" -> {"likes", "spicy", "food", "lot"} (4 words)
    // Intersection: 3, Union: 4 -> 3/4 = 0.75
    const similarity = computeContentSimilarity(
      "Likes spicy food",
      "Likes spicy food a lot",
    );
    expect(similarity).toBeCloseTo(0.75, 2);
    expect(similarity).toBeGreaterThan(0.70);
  });

  it("returns 0 for completely different texts", () => {
    const similarity = computeContentSimilarity(
      "pasta carbonara recipe",
      "yoga morning routine",
    );
    expect(similarity).toBe(0);
  });

  it("returns 0 for empty strings", () => {
    expect(computeContentSimilarity("", "")).toBe(0);
    expect(computeContentSimilarity("hello", "")).toBe(0);
    expect(computeContentSimilarity("", "hello")).toBe(0);
  });

  it("filters stop words from similarity calculation", () => {
    // "a" and "the" are stop words and should not count
    const sim1 = computeContentSimilarity("the big dog", "a big dog");
    // After stop words: {"big", "dog"} vs {"big", "dog"} -> 1.0
    expect(sim1).toBe(1.0);
  });
});
