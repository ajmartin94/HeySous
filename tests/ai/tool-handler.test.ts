import { describe, it, expect, vi } from "vitest";
import { createToolHandler } from "../../src/ai/tool-handler.js";
import type { PlanEntry, SavedPlan } from "../../src/planning/repository.js";
import { createTestClock } from "../../src/clock.js";

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
