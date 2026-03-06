/**
 * Regression tests for onboarding-memory integration.
 *
 * Verifies that:
 * 1. MEMORY_TOOLS contains save_memory, delete_memory, search_memories
 * 2. The onboarding preferences prompt references save_memory
 * 3. The prompt covers all expected memory categories
 * 4. The prompt instructs saving memories inline (not at the end)
 */

import { describe, it, expect, vi } from "vitest";

// Mock logger before importing modules that use it
vi.mock("../../src/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

import { MEMORY_TOOLS } from "../../src/ai/tools.js";
import { buildOnboardingPrompt } from "../../src/onboarding/prompt.js";

describe("Onboarding-Memory Integration", () => {
  describe("MEMORY_TOOLS availability", () => {
    it("should contain save_memory tool", () => {
      const toolNames = MEMORY_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("save_memory");
    });

    it("should contain delete_memory tool", () => {
      const toolNames = MEMORY_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("delete_memory");
    });

    it("should contain search_memories tool", () => {
      const toolNames = MEMORY_TOOLS.map((t) => t.name);
      expect(toolNames).toContain("search_memories");
    });

    it("should have at least 3 tools", () => {
      expect(MEMORY_TOOLS.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("Onboarding preferences prompt references save_memory", () => {
    const preferencesPrompt = buildOnboardingPrompt("preferences");

    it("should reference save_memory in the prompt text", () => {
      expect(preferencesPrompt).toContain("save_memory");
    });

    it("should reference dietary category", () => {
      expect(preferencesPrompt).toContain("dietary");
    });

    it("should reference taste category", () => {
      expect(preferencesPrompt).toContain("taste");
    });

    it("should reference schedule category", () => {
      expect(preferencesPrompt).toContain("schedule");
    });

    it("should reference logistics category", () => {
      expect(preferencesPrompt).toContain("logistics");
    });

    it("should reference cooking_style category", () => {
      expect(preferencesPrompt).toContain("cooking_style");
    });

    it("should instruct saving memories inline, not at the end", () => {
      expect(preferencesPrompt).toMatch(/don.t wait until the end/i);
    });
  });
});
