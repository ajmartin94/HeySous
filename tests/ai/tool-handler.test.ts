import { describe, it, expect, vi } from "vitest";
import { createToolHandler } from "../../src/ai/tool-handler.js";
import type { PlanEntry, SavedPlan } from "../../src/planning/repository.js";
import { createTestClock } from "../../src/clock.js";

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

describe("tool-handler update_knowledge", () => {
  function createUpdateKnowledgeDeps() {
    const mockKnowledgeRepository = {
      getById: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    };

    const mockDb = {
      insert: vi.fn(() => ({
        values: () => ({ run: vi.fn() }),
      })),
    };

    const handler = createToolHandler({
      retrievalService: {} as any,
      knowledgeRepository: mockKnowledgeRepository as any,
      db: mockDb as any,
      householdId: "test-household",
      clock: createTestClock(new Date("2026-02-18")),
    });

    return { handler, mockKnowledgeRepository, mockDb };
  }

  it("rejects update with no substantive fields", () => {
    const { handler, mockKnowledgeRepository } = createUpdateKnowledgeDeps();

    const result = JSON.parse(
      handler.handleToolCall("update_knowledge", {
        id: 1,
        change_description: "make it spicier",
      }),
    );

    expect(result.error).toContain("No fields to update");
    // Guard fires before any DB access
    expect(mockKnowledgeRepository.getById).not.toHaveBeenCalled();
  });

  it("accepts update with content field", () => {
    const { handler, mockKnowledgeRepository } = createUpdateKnowledgeDeps();

    mockKnowledgeRepository.getById.mockReturnValue({
      id: 1,
      title: "Test Recipe",
      content: "old content",
      summary: "s",
      tags: ["recipe"],
    });
    mockKnowledgeRepository.update.mockReturnValue({
      id: 1,
      title: "Test Recipe",
      content: "new content",
      summary: "s",
      tags: ["recipe"],
    });

    const result = JSON.parse(
      handler.handleToolCall("update_knowledge", {
        id: 1,
        content: "new content",
        change_description: "updated recipe content",
      }),
    );

    expect(result.message).toContain("Updated");
    expect(result.error).toBeUndefined();
    expect(mockKnowledgeRepository.getById).toHaveBeenCalledWith(1, "test-household");
    expect(mockKnowledgeRepository.update).toHaveBeenCalledWith(1, "test-household", { content: "new content" });
  });
});

describe("tool-handler save_meal_plan", () => {
  it("includes knowledgeItemId in result when provided", () => {
    const { handler, mockPlanRepository } = createMockDeps();

    const result = JSON.parse(
      handler.handleToolCall("save_meal_plan", {
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

  it("has null knowledgeItemId when not provided", () => {
    const { handler } = createMockDeps();

    const result = JSON.parse(
      handler.handleToolCall("save_meal_plan", {
        week_start_date: "2026-02-16",
        entries: [{ day: 0, recipe_name: "New Recipe" }],
      }),
    );

    expect(result.plan.entries[0].knowledgeItemId).toBeNull();
  });
});
