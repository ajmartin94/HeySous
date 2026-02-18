import { describe, it, expect } from "vitest";
import { buildPlanContext } from "../../src/planning/context.js";
import type { SavedPlan } from "../../src/planning/repository.js";

function makePlan(
  entries: Array<{ day: number; name: string; id: number | null }>,
): SavedPlan {
  return {
    id: 1,
    weekStartDate: "2026-02-16",
    entries: entries.map((e, i) => ({
      id: i + 1,
      dayOfWeek: e.day,
      mealType: "dinner",
      recipeName: e.name,
      knowledgeItemId: e.id,
    })),
  };
}

describe("buildPlanContext", () => {
  it("includes [recipe #ID] suffix for entries with knowledgeItemId", () => {
    const plan = makePlan([{ day: 0, name: "Fish Tacos", id: 42 }]);
    const result = buildPlanContext([plan], []);

    expect(result).toContain("[recipe #42]");
    expect(result).toContain("Fish Tacos");
  });

  it("omits suffix for entries with null knowledgeItemId", () => {
    const plan = makePlan([{ day: 0, name: "Fish Tacos", id: null }]);
    const result = buildPlanContext([plan], []);

    expect(result).toContain("Fish Tacos");
    expect(result).not.toContain("[recipe #");
  });

  it("handles mixed linked and unlinked entries", () => {
    const plan = makePlan([
      { day: 0, name: "Fish Tacos", id: 31 },
      { day: 1, name: "New Suggestion", id: null },
      { day: 2, name: "Sheet Pan Vegetables", id: 28 },
    ]);
    const result = buildPlanContext([plan], []);

    expect(result).toContain("[recipe #31]");
    expect(result).toContain("[recipe #28]");

    // The unlinked entry line should not have a recipe ID suffix
    const lines = result.split("\n");
    const suggestionLine = lines.find((l) => l.includes("New Suggestion"));
    expect(suggestionLine).toBeDefined();
    expect(suggestionLine).not.toContain("[recipe #");
  });
});
