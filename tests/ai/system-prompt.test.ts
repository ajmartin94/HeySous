import { describe, it, expect } from "vitest";
import { buildSystemPrompt, buildDynamicContext } from "../../src/ai/system-prompt.js";

describe("buildSystemPrompt", () => {
  const prompt = buildSystemPrompt();

  it("includes LINKING RECIPES TO PLANS section", () => {
    expect(prompt).toContain("LINKING RECIPES TO PLANS");
  });

  it("references knowledge_item_id and search_knowledge", () => {
    expect(prompt).toContain("knowledge_item_id");
    expect(prompt).toContain("search_knowledge");
  });

  it("includes current date context when dateContext is provided", () => {
    const dateContext = '<current_date>\nToday is Wednesday, February 19, 2026 (2026-02-19).\n</current_date>';
    const prompt = buildSystemPrompt(undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, dateContext);
    expect(prompt).toContain("<current_date>");
    expect(prompt).toContain("2026-02-19");
  });

  it("does not include date context when not provided", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).not.toContain("<current_date>");
  });

  it("includes the bare-weekday next-future-occurrence rule", () => {
    expect(prompt).toContain("WEEKDAY RULE");
    expect(prompt).toContain("NEXT future occurrence");
    // Must explicitly forbid resolving to a past date and asking which one.
    expect(prompt).toContain("Never resolve it to a past date");
    expect(prompt).toContain('never ask the user "which Tuesday?"');
  });

  it("clarifies log_meal vs save_meal_plan and requires plan updates for reported changes", () => {
    expect(prompt).toContain("log_meal VS save_meal_plan");
    expect(prompt).toContain("log_meal does NOT touch the meal plan");
    expect(prompt).toContain("MUST be updated via save_meal_plan");
    expect(prompt).toContain("Calling log_meal is NOT a substitute for updating the plan");
  });
});

describe("buildDynamicContext sanitization", () => {
  it("sanitizes HTML from userName", () => {
    const result = buildDynamicContext({ userName: "<b>John</b>" });
    expect(result).toContain("John");
    expect(result).not.toContain("<b>");
    expect(result).not.toContain("</b>");
  });

  it("passes clean userName through unchanged", () => {
    const result = buildDynamicContext({ userName: "Alice" });
    expect(result).toContain("Alice");
  });

  it("sanitizes HTML from memory content", () => {
    const result = buildDynamicContext({
      memories: [
        {
          id: 1,
          content: "<script>Does not eat</script> pork products",
          category: "dietary",
        },
      ],
    });
    expect(result).toContain("Does not eat pork products");
    expect(result).not.toContain("<script>");
  });

  it("preserves clean memory text unchanged", () => {
    const result = buildDynamicContext({
      memories: [
        {
          id: 1,
          content: "Prefers vegetarian meals",
          category: "taste",
        },
      ],
    });
    expect(result).toContain("Prefers vegetarian meals");
  });
});
