import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../../src/ai/system-prompt.js";

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
