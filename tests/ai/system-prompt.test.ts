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
