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
});
