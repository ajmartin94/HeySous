import { describe, it, expect, vi } from "vitest";
import Database from "better-sqlite3";
import { createToolHandler } from "../../src/ai/tool-handler.js";
import type { PlanEntry, SavedPlan } from "../../src/planning/repository.js";
import { createTestClock } from "../../src/clock.js";
import { initializeFts } from "../../src/knowledge/fts.js";

/** Helper to parse a validation error response */
function parseError(result: string): { error: string; is_error: boolean } {
  return JSON.parse(result);
}

function createValidationDeps() {
  const mockSearch = vi.fn().mockReturnValue({ results: [], metrics: { tokensUsed: 0 } });
  const mockGetItem = vi.fn().mockReturnValue(null);

  const mockPlanRepository = {
    savePlan: vi.fn(
      (
        _householdId: string,
        weekStartDate: string,
        entries: PlanEntry[],
      ): SavedPlan => ({
        id: 1,
        weekStartDate,
        entries: entries.map((e, i) => ({
          id: i + 1,
          dayOfWeek: e.day,
          mealType: e.mealType ?? "dinner",
          recipeName: e.recipeName,
          knowledgeItemId: e.knowledgeItemId ?? null,
        })),
      }),
    ),
    getPlan: vi.fn(),
    getActivePlans: vi.fn(),
  };

  const mockGroceryRepository = {
    createList: vi.fn().mockReturnValue({ id: 1 }),
    addItems: vi.fn(),
    getActiveList: vi.fn().mockReturnValue({ id: 1, status: "active", messageId: null }),
    getListItems: vi.fn().mockReturnValue([]),
    removeItems: vi.fn(),
    checkItems: vi.fn(),
    uncheckItems: vi.fn(),
  };

  const mockAppFeedbackRepository = {
    saveFeedback: vi.fn(),
  };

  const mockKnowledgeRepository = {
    create: vi.fn().mockReturnValue({ id: 1 }),
    getById: vi.fn().mockReturnValue(null),
    update: vi.fn(),
    delete: vi.fn(),
  };

  // Minimal mock for sqlite (just needs to be truthy for some tool paths)
  const mockSqlite = {} as any;

  const handler = createToolHandler({
    retrievalService: { search: mockSearch, getItem: mockGetItem } as any,
    knowledgeRepository: mockKnowledgeRepository as any,
    db: { insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ run: vi.fn() }) }) } as any,
    householdId: "test-household",
    planRepository: mockPlanRepository as any,
    sqlite: mockSqlite,
    groceryRepository: mockGroceryRepository as any,
    appFeedbackRepository: mockAppFeedbackRepository as any,
    clock: createTestClock(new Date("2026-02-18")),
  });

  return { handler };
}

function createMockDeps() {
  const mockPlanRepository = {
    savePlan: vi.fn(
      (
        _householdId: string,
        weekStartDate: string,
        entries: PlanEntry[],
      ): SavedPlan => ({
        id: 1,
        weekStartDate,
        entries: entries.map((e, i) => ({
          id: i + 1,
          dayOfWeek: e.day,
          mealType: e.mealType ?? "dinner",
          recipeName: e.recipeName,
          knowledgeItemId: e.knowledgeItemId ?? null,
        })),
      }),
    ),
    getPlan: vi.fn(),
    getActivePlans: vi.fn(),
  };

  const handler = createToolHandler({
    retrievalService: {} as any,
    knowledgeRepository: {} as any,
    db: {} as any,
    householdId: "test-household",
    planRepository: mockPlanRepository as any,
    clock: createTestClock(new Date("2026-02-18")),
  });

  return { handler, mockPlanRepository };
}

describe("tool-handler save_meal_plan", () => {
  it("includes knowledgeItemId in result when provided", async () => {
    const { handler, mockPlanRepository } = createMockDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-16",
        entries: [
          { day: 0, recipe_name: "Fish Tacos", knowledge_item_id: 31 },
          {
            day: 1,
            recipe_name: "Sheet Pan Vegetables",
            knowledge_item_id: 28,
          },
        ],
      }),
    );

    expect(result.plan.entries[0].knowledgeItemId).toBe(31);
    expect(result.plan.entries[1].knowledgeItemId).toBe(28);

    // Verify the IDs were passed through to the repository
    const savedEntries = mockPlanRepository.savePlan.mock.calls[0][2];
    expect(savedEntries[0].knowledgeItemId).toBe(31);
    expect(savedEntries[1].knowledgeItemId).toBe(28);
  });

  it("has null knowledgeItemId when not provided", async () => {
    const { handler } = createMockDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-16",
        entries: [{ day: 0, recipe_name: "New Recipe" }],
      }),
    );

    expect(result.plan.entries[0].knowledgeItemId).toBeNull();
  });
});

describe("input validation", () => {
  it("rejects search_knowledge query exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("search_knowledge", { query: "x".repeat(501) }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("query must be at most 500 characters");
    expect(result.error).toContain("501");
  });

  it("rejects get_knowledge_item with negative id", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("get_knowledge_item", { id: -3 }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("id must be a positive integer");
    expect(result.error).toContain("-3");
  });

  it("rejects get_knowledge_item with zero id", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("get_knowledge_item", { id: 0 }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("positive integer");
  });

  it("rejects save_grocery_list with too many items", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_grocery_list", {
        items: Array(201).fill({ name: "x", store: "s", section: "s" }),
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("items must have at most 200 items");
    expect(result.error).toContain("201");
  });

  it("rejects save_knowledge with title exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_knowledge", {
        title: "x".repeat(201),
        summary: "s",
        content: "c",
        tags: ["t"],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("title must be at most 200 characters");
    expect(result.error).toContain("201");
  });

  it("rejects save_knowledge with too many tags", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_knowledge", {
        title: "t",
        summary: "s",
        content: "c",
        tags: Array(31).fill("tag"),
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("tags must have at most 30 items");
    expect(result.error).toContain("31");
  });

  it("rejects save_meal_plan with out-of-range day value", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2025-01-06",
        entries: [{ day: 7, recipe_name: "test" }],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("day must be an integer 0-6");
    expect(result.error).toContain("7");
  });

  it("allows valid search_knowledge inputs through", async () => {
    const { handler } = createValidationDeps();

    const result = await handler.handleToolCall("search_knowledge", { query: "chicken" });
    const parsed = JSON.parse(result);

    // Should not have is_error -- should be a normal result
    expect(parsed.is_error).toBeUndefined();
    expect(parsed.results).toBeDefined();
  });

  it("rejects import_from_url with url exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("import_from_url", { url: "x".repeat(2001) }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("url must be at most 2000 characters");
    expect(result.error).toContain("2001");
  });

  it("rejects delete_knowledge with non-integer id", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("delete_knowledge", { id: 1.5 }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("id must be a positive integer");
  });

  it("rejects update_knowledge with overly long change_description", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("update_knowledge", {
        id: 1,
        title: "updated",
        change_description: "x".repeat(501),
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("change_description must be at most 500 characters");
  });

  it("rejects save_app_feedback with text exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_app_feedback", {
        text: "x".repeat(5001),
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("text must be at most 5000 characters");
  });

  it("rejects record_feedback with notes exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("record_feedback", {
        recipe_name: "test",
        sentiment: "positive",
        notes: "x".repeat(2001),
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("notes must be at most 2000 characters");
  });

  it("rejects search_knowledge with limit out of range", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("search_knowledge", { query: "test", limit: 25 }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("limit must be 1-20");
  });

  it("rejects grocery item with name exceeding max length", async () => {
    const { handler } = createValidationDeps();

    const result = parseError(
      await handler.handleToolCall("save_grocery_list", {
        items: [{ name: "x".repeat(201), store: "s", section: "s" }],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.error).toContain("items[0].name must be at most 200 characters");
  });
});

describe("recipe completeness validation", () => {
  it("rejects recipe missing ingredients", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Chocolate Cake",
        summary: "A delicious cake",
        content: "Steps:\n1. Mix everything together\n2. Bake at 350",
        tags: ["recipe", "meal:dessert"],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.incomplete_recipe).toBe(true);
    expect(result.error).toContain("ingredients list");
    expect(result.error).not.toContain("instructions/steps");
  });

  it("rejects recipe missing instructions", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Simple Salad",
        summary: "A quick salad",
        content: "Ingredients:\n- 1 cup lettuce\n- 2 tomatoes\n- 1 cucumber",
        tags: ["recipe", "meal:lunch"],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.incomplete_recipe).toBe(true);
    expect(result.error).toContain("instructions/steps");
    expect(result.error).not.toContain("ingredients list");
  });

  it("rejects recipe missing both ingredients and instructions", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Mystery Dish",
        summary: "Something tasty",
        content: "Some text about food that is not structured",
        tags: ["recipe"],
      }),
    );

    expect(result.is_error).toBe(true);
    expect(result.incomplete_recipe).toBe(true);
    expect(result.error).toContain("ingredients list");
    expect(result.error).toContain("instructions/steps");
  });

  it("accepts complete recipe", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Pasta Marinara",
        summary: "Classic Italian pasta",
        content: "Ingredients:\n- 1 lb pasta\n- 2 cups marinara sauce\n\nSteps:\n1. Boil pasta\n2. Heat sauce\n3. Combine and serve",
        tags: ["recipe", "cuisine:italian"],
      }),
    );

    expect(result.is_error).toBeUndefined();
    expect(result.incomplete_recipe).toBeUndefined();
    expect(result.id).toBe(1);
    expect(result.message).toContain("Pasta Marinara");
  });

  it("skips validation for non-recipe items (preferences)", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Dietary Preference",
        summary: "No gluten",
        content: "I don't eat gluten",
        tags: ["preference", "pref:dietary"],
      }),
    );

    expect(result.is_error).toBeUndefined();
    expect(result.incomplete_recipe).toBeUndefined();
    expect(result.id).toBe(1);
  });

  it("skips validation when tags don't include 'recipe'", async () => {
    const { handler } = createValidationDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_knowledge", {
        title: "Cooking Tip",
        summary: "Always season your cast iron",
        content: "Cast iron care tips and tricks",
        tags: ["note", "cooking-tip"],
      }),
    );

    expect(result.is_error).toBeUndefined();
    expect(result.incomplete_recipe).toBeUndefined();
    expect(result.id).toBe(1);
  });
});

describe("save_meal_plan auto-linking", () => {
  function createAutoLinkDeps() {
    // Create a real in-memory SQLite database with FTS
    const sqlite = new Database(":memory:");
    sqlite.exec(`
      CREATE TABLE knowledge_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        household_id TEXT NOT NULL,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        source_url TEXT,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        last_accessed_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
        version INTEGER NOT NULL DEFAULT 1,
        updated_by TEXT,
        prep_time_minutes INTEGER,
        cook_time_minutes INTEGER,
        total_time_minutes INTEGER
      )
    `);
    initializeFts(sqlite);

    // Insert test recipes
    sqlite.prepare(
      "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)"
    ).run(50, "test-household", "Classic Pancakes", "Fluffy pancakes", "Ingredients:\n- flour\nSteps:\n1. Mix");
    sqlite.prepare(
      "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)"
    ).run(44, "test-household", "Fish Tacos", "Crispy fish tacos", "Ingredients:\n- fish\nSteps:\n1. Fry");
    sqlite.prepare(
      "INSERT INTO knowledge_items (id, household_id, title, summary, content) VALUES (?, ?, ?, ?, ?)"
    ).run(99, "other-household", "Classic Pancakes", "Different pancakes", "Ingredients:\n- flour\nSteps:\n1. Mix");

    const mockPlanRepository = {
      savePlan: vi.fn(
        (
          _householdId: string,
          weekStartDate: string,
          entries: PlanEntry[],
        ): SavedPlan => ({
          id: 1,
          weekStartDate,
          entries: entries.map((e, i) => ({
            id: i + 1,
            dayOfWeek: e.day,
            mealType: e.mealType ?? "dinner",
            recipeName: e.recipeName,
            knowledgeItemId: e.knowledgeItemId ?? null,
          })),
        }),
      ),
      getPlan: vi.fn(),
      getActivePlans: vi.fn(),
    };

    const handler = createToolHandler({
      retrievalService: {} as any,
      knowledgeRepository: {} as any,
      db: {} as any,
      householdId: "test-household",
      planRepository: mockPlanRepository as any,
      sqlite,
      clock: createTestClock(new Date("2026-02-18")),
    });

    return { handler, mockPlanRepository, sqlite };
  }

  it("auto-links entries that match knowledge base recipes by name", async () => {
    const { handler, mockPlanRepository } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          { day: 0, recipe_name: "Classic Pancakes" },
          { day: 1, recipe_name: "Fish Tacos" },
        ],
      }),
    );

    // Entries should be auto-linked to their KB matches
    expect(result.plan.entries[0].knowledgeItemId).toBe(50);
    expect(result.plan.entries[1].knowledgeItemId).toBe(44);

    // Verify auto-linked info is in response
    expect(result.auto_linked).toHaveLength(2);
    expect(result.auto_linked[0].recipe_name).toBe("Classic Pancakes");
    expect(result.auto_linked[0].knowledge_item_id).toBe(50);

    // Verify repository received the linked entries
    const savedEntries = mockPlanRepository.savePlan.mock.calls[0][2];
    expect(savedEntries[0].knowledgeItemId).toBe(50);
    expect(savedEntries[1].knowledgeItemId).toBe(44);
  });

  it("does not auto-link entries with no KB match", async () => {
    const { handler } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          { day: 0, recipe_name: "Beef Wellington" },
        ],
      }),
    );

    expect(result.plan.entries[0].knowledgeItemId).toBeNull();
    expect(result.auto_linked).toBeUndefined();
  });

  it("validates and corrects invalid knowledge_item_id from Claude", async () => {
    const { handler, mockPlanRepository } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          // Claude provides ID 1 which doesn't exist -- should correct to 50
          { day: 0, recipe_name: "Classic Pancakes", knowledge_item_id: 1 },
        ],
      }),
    );

    // Should be corrected to the real ID 50
    expect(result.plan.entries[0].knowledgeItemId).toBe(50);

    // Verify the corrected ID was saved
    const savedEntries = mockPlanRepository.savePlan.mock.calls[0][2];
    expect(savedEntries[0].knowledgeItemId).toBe(50);
  });

  it("rejects knowledge_item_id from wrong household", async () => {
    const { handler, mockPlanRepository } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          // ID 99 exists but belongs to other-household
          { day: 0, recipe_name: "New Recipe", knowledge_item_id: 99 },
        ],
      }),
    );

    // Should be cleared (no FTS match for "New Recipe")
    expect(result.plan.entries[0].knowledgeItemId).toBeNull();

    const savedEntries = mockPlanRepository.savePlan.mock.calls[0][2];
    expect(savedEntries[0].knowledgeItemId).toBeUndefined();
  });

  it("preserves valid knowledge_item_id without modification", async () => {
    const { handler, mockPlanRepository } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          // Claude provides correct ID 50
          { day: 0, recipe_name: "Classic Pancakes", knowledge_item_id: 50 },
        ],
      }),
    );

    // Valid ID should pass through unchanged
    expect(result.plan.entries[0].knowledgeItemId).toBe(50);
    expect(result.auto_linked).toBeUndefined();

    const savedEntries = mockPlanRepository.savePlan.mock.calls[0][2];
    expect(savedEntries[0].knowledgeItemId).toBe(50);
  });

  it("handles mix of linked, unlinked, and auto-linked entries", async () => {
    const { handler } = createAutoLinkDeps();

    const result = JSON.parse(
      await handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-23",
        entries: [
          { day: 0, recipe_name: "Classic Pancakes", knowledge_item_id: 50 }, // valid, keep
          { day: 1, recipe_name: "Fish Tacos" },                              // auto-link to 44
          { day: 2, recipe_name: "Beef Wellington" },                          // no match, stays null
        ],
      }),
    );

    expect(result.plan.entries[0].knowledgeItemId).toBe(50);  // preserved
    expect(result.plan.entries[1].knowledgeItemId).toBe(44);  // auto-linked
    expect(result.plan.entries[2].knowledgeItemId).toBeNull(); // no match

    // Only Fish Tacos should be in auto_linked
    expect(result.auto_linked).toHaveLength(1);
    expect(result.auto_linked[0].recipe_name).toBe("Fish Tacos");
  });
});
