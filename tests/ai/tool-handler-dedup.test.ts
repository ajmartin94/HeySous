import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { createToolHandler } from "../../src/ai/tool-handler.js";
import { initializeFts } from "../../src/knowledge/fts.js";
import * as ftsModule from "../../src/knowledge/fts.js";
import { createTestClock } from "../../src/clock.js";

vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const HOUSEHOLD_ID = "test-household";

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  initializeFts(sqlite);
  return sqlite;
}

function insertKnowledgeItem(
  sqlite: InstanceType<typeof Database>,
  id: number,
  title: string,
  summary: string,
  content: string,
) {
  sqlite
    .prepare(
      "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, HOUSEHOLD_ID, title, summary, content);
}

function createMockDeps(sqlite: InstanceType<typeof Database>) {
  const mockKnowledgeRepository = {
    create: vi.fn((_householdId: string, input: { title: string; summary: string; content: string; tags: string[] }) => ({
      id: 99,
      title: input.title,
      summary: input.summary,
      content: input.content,
      tags: input.tags,
      source: "conversation",
    })),
    getById: vi.fn((id: number, _householdId: string) => {
      const row = sqlite
        .prepare("SELECT * FROM knowledge_items WHERE id = ? AND household_id = ?")
        .get(id, HOUSEHOLD_ID) as { id: number; title: string; summary: string; content: string } | undefined;
      if (!row) return null;
      return { id: row.id, title: row.title, summary: row.summary, content: row.content, tags: [], source: "conversation" };
    }),
    update: vi.fn((_id: number, _householdId: string, changes: Record<string, unknown>) => ({
      id: _id,
      title: (changes.title as string) ?? "Updated",
      summary: "updated",
      content: "updated",
      tags: [],
      source: "conversation",
    })),
  };

  const mockInsert = vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      run: vi.fn(),
    }),
  });

  const mockDb = {
    insert: mockInsert,
  } as any;

  const handler = createToolHandler({
    retrievalService: {} as any,
    knowledgeRepository: mockKnowledgeRepository as any,
    db: mockDb,
    householdId: HOUSEHOLD_ID,
    sqlite,
    clock: createTestClock(),
  });

  return { handler, mockKnowledgeRepository };
}

describe("save_knowledge dedup", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = createTestDb();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("returns duplicate_found for exact title match", async () => {
    insertKnowledgeItem(sqlite, 1, "Chicken Parmesan", "Classic Italian chicken dish", "Ingredients: chicken, mozzarella...");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Chicken Parmesan",
        summary: "A chicken parmesan recipe",
        content: "Ingredients:\n- 2 chicken breasts\n- 1 cup mozzarella\n\nSteps:\n1. Bread and fry chicken\n2. Top with cheese",
        tags: ["recipe"],
      }),
    );

    expect(result.duplicate_found).toBe(true);
    expect(result.existing_item.title).toBe("Chicken Parmesan");
    expect(result.existing_item.id).toBe(1);
  });

  it("returns duplicate_found for case-insensitive title match", async () => {
    insertKnowledgeItem(sqlite, 1, "Chicken Parmesan", "Classic Italian chicken dish", "Ingredients: chicken...");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "chicken parmesan",
        summary: "A chicken parmesan recipe",
        content: "Ingredients:\n- 2 chicken breasts\n- 1 cup mozzarella\n\nSteps:\n1. Bread and fry chicken\n2. Top with cheese",
        tags: ["recipe"],
      }),
    );

    expect(result.duplicate_found).toBe(true);
    expect(result.existing_item.title).toBe("Chicken Parmesan");
  });

  it("allows save when skip_dedup is true", async () => {
    insertKnowledgeItem(sqlite, 1, "Chicken Parmesan", "Classic Italian chicken dish", "Ingredients: chicken...");

    const { handler, mockKnowledgeRepository } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Chicken Parmesan",
        summary: "A different chicken parm",
        content: "Ingredients:\n- 2 chicken breasts\n- 1 cup mozzarella\n\nSteps:\n1. Pan fry chicken\n2. Add cheese and bake",
        tags: ["recipe"],
        skip_dedup: true,
      }),
    );

    expect(result.duplicate_found).toBeUndefined();
    expect(result.id).toBe(99);
    expect(mockKnowledgeRepository.create).toHaveBeenCalled();
  });

  it("allows save when no similar items exist", async () => {
    const { handler, mockKnowledgeRepository } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Unique Thai Basil Stir Fry",
        summary: "Quick Thai stir fry",
        content: "Ingredients:\n- 1 cup basil\n- 1 block tofu\n\nSteps:\n1. Stir fry tofu\n2. Add basil",
        tags: ["recipe"],
      }),
    );

    expect(result.duplicate_found).toBeUndefined();
    expect(result.id).toBe(99);
    expect(mockKnowledgeRepository.create).toHaveBeenCalled();
  });

  it("dedup works for preferences", async () => {
    insertKnowledgeItem(sqlite, 1, "No Cilantro", "Dietary restriction - no cilantro", "I do not like cilantro in any dishes.");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "No Cilantro",
        summary: "Hates cilantro",
        content: "No cilantro please",
        tags: ["preference", "pref:dietary"],
      }),
    );

    expect(result.duplicate_found).toBe(true);
    expect(result.existing_item.title).toBe("No Cilantro");
  });
});

describe("update_knowledge validation", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = createTestDb();
  });

  afterEach(() => {
    sqlite.close();
  });

  it("rejects update with no substantive fields", async () => {
    insertKnowledgeItem(sqlite, 1, "Test Recipe", "Summary", "Content");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("update_knowledge", { id: 1 }),
    );

    expect(result.error).toContain("No substantive fields");
  });

  it("rejects update with only change_description", async () => {
    insertKnowledgeItem(sqlite, 1, "Test Recipe", "Summary", "Content");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("update_knowledge", {
        id: 1,
        change_description: "Some change note",
      }),
    );

    expect(result.error).toContain("No substantive fields");
  });

  it("allows update with title change", async () => {
    insertKnowledgeItem(sqlite, 1, "Test Recipe", "Summary", "Content");

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("update_knowledge", {
        id: 1,
        title: "New Title",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(result.message).toContain("Updated");
  });
});

describe("BM25 threshold accuracy", () => {
  let sqlite: InstanceType<typeof Database>;

  beforeEach(() => {
    sqlite = createTestDb();
  });

  afterEach(() => {
    sqlite.close();
  });

  // NOTE: BM25 scores depend on corpus statistics (document count, term frequency).
  // With a single-document corpus, absolute score values may differ from production.
  // This test validates the threshold DIRECTION (< 5 rejects weak matches) rather
  // than exact score values.
  it("does NOT trigger dedup for weak FTS matches (different recipes sharing a word)", async () => {
    insertKnowledgeItem(
      sqlite,
      1,
      "Classic Beef Stew",
      "Hearty winter beef stew with root vegetables",
      "A slow-cooked beef stew recipe with carrots, potatoes, and herbs",
    );

    const { handler, mockKnowledgeRepository } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Beef Tacos",
        summary: "Quick weeknight beef tacos",
        content: "Ingredients:\n- 1 lb ground beef\n- 8 taco shells\n\nSteps:\n1. Brown beef\n2. Fill shells",
        tags: ["recipe"],
      }),
    );

    // Weak match — should NOT trigger dedup
    expect(result.duplicate_found).toBeUndefined();
    expect(mockKnowledgeRepository.create).toHaveBeenCalled();
  });

  it("does NOT trigger dedup when searchFts returns relevance >= 5 (weak match)", async () => {
    // Mock searchFts to return a weak match (relevance 8.5 = far from title)
    vi.spyOn(ftsModule, "searchFts").mockReturnValue([
      {
        id: 1,
        title: "Classic Beef Stew",
        summary: "A stew",
        relevance: 8.5,
        tags: [],
        lastAccessedAt: new Date(),
      },
    ]);

    const { handler, mockKnowledgeRepository } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Beef Tacos",
        summary: "Quick tacos",
        content: "Ingredients:\n- 1 lb ground beef\n- 8 taco shells\n\nSteps:\n1. Brown beef\n2. Fill shells",
        tags: ["recipe"],
      }),
    );

    expect(result.duplicate_found).toBeUndefined();
    expect(mockKnowledgeRepository.create).toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("DOES trigger dedup when searchFts returns relevance < 5 (strong match)", async () => {
    // Mock searchFts to return a strong match (relevance 2.1 = close title overlap)
    vi.spyOn(ftsModule, "searchFts").mockReturnValue([
      {
        id: 1,
        title: "Chicken Tikka Masala",
        summary: "Indian curry",
        relevance: 2.1,
        tags: [],
        lastAccessedAt: new Date(),
      },
    ]);

    const { handler } = createMockDeps(sqlite);
    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Chicken Tikka Masala Recipe",
        summary: "Tikka masala",
        content: "Ingredients:\n- 2 lbs chicken\n- 1 cup tikka paste\n\nSteps:\n1. Marinate chicken\n2. Cook in sauce",
        tags: ["recipe"],
      }),
    );

    expect(result.duplicate_found).toBe(true);
    vi.restoreAllMocks();
  });
});
