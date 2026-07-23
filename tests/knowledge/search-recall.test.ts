import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { initializeFts, searchFts } from "../../src/knowledge/fts.js";

const HOUSEHOLD_ID = "test-household";

/**
 * Recall-focused tests reproducing three real production reports:
 *  1. Verbatim-title lookups must always find the recipe.
 *  2. Search should not be overly literal: "miso glazed fish" should surface
 *     both "Miso Glazed Salmon" and "Miso Glazed Tilapia".
 *  3. A couple of keywords from a title should be enough to find it.
 */
describe("searchFts recall", () => {
  let sqlite: InstanceType<typeof Database>;

  const insert = (
    id: number,
    title: string,
    summary: string,
    content: string,
    tags: string[] = [],
  ) => {
    sqlite
      .prepare(
        "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)",
      )
      .run(id, HOUSEHOLD_ID, title, summary, content);
    const tagStmt = sqlite.prepare(
      "INSERT INTO knowledge_tags (knowledge_item_id, tag) VALUES (?, ?)",
    );
    for (const tag of tags) tagStmt.run(id, tag);
  };

  const titles = (query: string, limit = 10) =>
    searchFts(sqlite, query, HOUSEHOLD_ID, limit, "wide").map((r) => r.title);

  beforeEach(() => {
    sqlite = new Database(":memory:");
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    initializeFts(sqlite);

    insert(
      1,
      "Miso Glazed Salmon",
      "Sweet and savory miso-glazed salmon fillets, broiled until caramelized.",
      "Ingredients:\n- salmon\n- white miso\n- mirin\nSteps:\n1. Glaze and broil the salmon.",
      ["fish", "japanese", "dinner"],
    );
    insert(
      2,
      "Miso Glazed Tilapia",
      "A lighter take on miso glaze using tilapia fillets.",
      "Ingredients:\n- tilapia\n- white miso\n- honey\nSteps:\n1. Glaze and bake the tilapia.",
      ["fish", "weeknight"],
    );
    insert(
      3,
      "Grandma's Chicken Noodle Soup",
      "A comforting chicken noodle soup that simmers all afternoon.",
      "Ingredients:\n- chicken\n- egg noodles\n- carrots\nSteps:\n1. Simmer everything.",
      ["soup", "comfort"],
    );
    insert(
      4,
      "Spicy Peanut Noodles",
      "Quick cold noodles tossed in a spicy peanut sauce.",
      "Ingredients:\n- noodles\n- peanut butter\n- chili crisp\nSteps:\n1. Toss and serve.",
      ["noodles", "vegetarian"],
    );
    // "miso" appears only in this recipe's content, never its title/summary.
    insert(
      5,
      "Weeknight Ramen Bowl",
      "A fast ramen bowl for busy nights.",
      "Ingredients:\n- ramen noodles\n- miso paste\n- scallions\nSteps:\n1. Simmer and slurp.",
      ["noodles", "soup"],
    );
  });

  afterEach(() => {
    sqlite.close();
  });

  it("finds a recipe by its verbatim title", () => {
    expect(titles("Miso Glazed Salmon")).toContain("Miso Glazed Salmon");
    expect(titles("Grandma's Chicken Noodle Soup")).toContain(
      "Grandma's Chicken Noodle Soup",
    );
    expect(titles("Spicy Peanut Noodles")).toContain("Spicy Peanut Noodles");
  });

  it("is not overly literal: 'miso glazed fish' finds both salmon and tilapia", () => {
    const found = titles("miso glazed fish");
    expect(found).toContain("Miso Glazed Salmon");
    expect(found).toContain("Miso Glazed Tilapia");
  });

  it("finds a recipe from just a couple of title keywords", () => {
    expect(titles("miso salmon")).toContain("Miso Glazed Salmon");
    expect(titles("chicken soup")).toContain("Grandma's Chicken Noodle Soup");
    expect(titles("peanut noodles")).toContain("Spicy Peanut Noodles");
  });

  it("ranks title matches ahead of incidental content matches", () => {
    // "miso" is in the two miso titles but only in the ramen recipe's content.
    // Title matches must outrank the content-only match.
    const found = titles("miso");
    const salmonIdx = found.indexOf("Miso Glazed Salmon");
    const tilapiaIdx = found.indexOf("Miso Glazed Tilapia");
    const ramenIdx = found.indexOf("Weeknight Ramen Bowl");
    expect(salmonIdx).toBeGreaterThanOrEqual(0);
    expect(tilapiaIdx).toBeGreaterThanOrEqual(0);
    expect(ramenIdx).toBeGreaterThan(salmonIdx);
    expect(ramenIdx).toBeGreaterThan(tilapiaIdx);
  });

  it("finds a recipe by a tag even when the tag is not in the title", () => {
    // "japanese" is only a tag on the salmon recipe.
    expect(titles("japanese")).toContain("Miso Glazed Salmon");
  });

  it("tolerates a single mistyped/extra term in an otherwise-verbatim title", () => {
    // User adds a descriptor that is not in the stored title.
    expect(titles("miso glazed salmon dinner tonight")).toContain(
      "Miso Glazed Salmon",
    );
  });

  it("returns empty for a query with no relationship to any recipe", () => {
    expect(titles("chocolate lava cake")).toHaveLength(0);
  });

  it("does not return items from other households", () => {
    sqlite
      .prepare(
        "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)",
      )
      .run(99, "other-household", "Miso Glazed Cod", "cod", "cod");
    const found = titles("miso glazed fish");
    expect(found).not.toContain("Miso Glazed Cod");
  });
});
