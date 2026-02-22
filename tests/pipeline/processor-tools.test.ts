import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createInstrumentedToolHandler } from "../../src/pipeline/processor.js";
import { sanitizeToolError } from "../../src/ai/claude-client.js";
import { config } from "../../src/config.js";

/**
 * Tests for tool call instrumentation (createInstrumentedToolHandler)
 * and error sanitization (sanitizeToolError).
 */

describe("createInstrumentedToolHandler", () => {
  let mockLogger: { info: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };
  const householdId = "household-test-123";

  beforeEach(() => {
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
    };
  });

  afterEach(() => {
    // Reset logToolInputs to default
    (config as any).logToolInputs = false;
  });

  it("logs at info level on successful tool call", async () => {
    const mockHandler = vi.fn().mockResolvedValue('{"result":"ok"}');
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    const result = await instrumented("search_knowledge", { query: "pasta" });

    expect(result).toBe('{"result":"ok"}');
    expect(mockHandler).toHaveBeenCalledWith("search_knowledge", { query: "pasta" });
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_name: "search_knowledge",
        duration_ms: expect.any(Number),
        household_id: householdId,
        status: "success",
      }),
      "Tool call completed",
    );
  });

  it("does NOT log tool_input on success by default", async () => {
    const mockHandler = vi.fn().mockResolvedValue("ok");
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    await instrumented("get_meal_plan", { week_start_date: "2026-02-17" });

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.tool_input).toBeUndefined();
  });

  it("logs tool_input on success when LOG_TOOL_INPUTS is true", async () => {
    (config as any).logToolInputs = true;
    const mockHandler = vi.fn().mockResolvedValue("ok");
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    const input = { query: "chicken recipes" };
    await instrumented("search_knowledge", input);

    const logData = mockLogger.info.mock.calls[0][0];
    expect(logData.tool_input).toEqual(input);
  });

  it("logs at error level with tool_input when handler throws", async () => {
    const mockHandler = vi.fn().mockRejectedValue(new Error("DB connection lost"));
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    const input = { id: 42 };
    await expect(instrumented("get_knowledge_item", input)).rejects.toThrow("DB connection lost");

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        tool_name: "get_knowledge_item",
        duration_ms: expect.any(Number),
        household_id: householdId,
        status: "error",
        error: "DB connection lost",
        tool_input: input,
      }),
      "Tool call completed",
    );
  });

  it("captures duration as a non-negative number", async () => {
    const mockHandler = vi.fn().mockResolvedValue("ok");
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    await instrumented("search_knowledge", { query: "test" });

    const logData = mockLogger.info.mock.calls[0][0];
    expect(typeof logData.duration_ms).toBe("number");
    expect(logData.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("re-throws the original error after logging", async () => {
    const originalError = new Error("Original error");
    const mockHandler = vi.fn().mockRejectedValue(originalError);
    const instrumented = createInstrumentedToolHandler(mockHandler, householdId, mockLogger as any);

    try {
      await instrumented("save_knowledge", { title: "test" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBe(originalError);
    }
  });
});

describe("sanitizeToolError", () => {
  it("strips stack trace lines", () => {
    const input = "Something failed at Object.foo (/src/bar.ts:10:5) at Module._compile (node:internal/modules/cjs/loader:1241:14)";
    const result = sanitizeToolError(new Error(input));
    expect(result).not.toContain("at Object.foo");
    expect(result).not.toContain("at Module._compile");
    expect(result).toContain("Something failed");
  });

  it("strips file paths", () => {
    const input = "Error in /home/user/project/src/ai/tool-handler.ts: something broke";
    const result = sanitizeToolError(new Error(input));
    expect(result).not.toContain("/home/user/project/src/ai/tool-handler.ts");
    expect(result).toContain("[path]");
  });

  it("strips SQL statements", () => {
    const input = "Failed: SELECT * FROM knowledge_items WHERE household_id = ?";
    const result = sanitizeToolError(new Error(input));
    expect(result).not.toContain("SELECT");
    expect(result).not.toContain("knowledge_items");
    expect(result).toContain("[sql]");
  });

  it("returns plain message for clean errors", () => {
    const input = "No item found with ID 5";
    const result = sanitizeToolError(new Error(input));
    expect(result).toBe("No item found with ID 5");
  });

  it("returns fallback for empty/whitespace input", () => {
    const result = sanitizeToolError(new Error(""));
    expect(result).toBe("An internal error occurred");
  });

  it("returns fallback when sanitization strips everything", () => {
    // A message that is entirely a stack trace
    const input = "  at Object.foo (/src/bar.ts:10:5)";
    const result = sanitizeToolError(new Error(input));
    expect(result).toBe("An internal error occurred");
  });

  it("handles non-Error objects: number", () => {
    const result = sanitizeToolError(42);
    expect(typeof result).toBe("string");
    expect(result).toBe("42");
  });

  it("handles non-Error objects: null", () => {
    const result = sanitizeToolError(null);
    expect(typeof result).toBe("string");
    expect(result).toBe("null");
  });

  it("handles non-Error objects: undefined", () => {
    const result = sanitizeToolError(undefined);
    expect(typeof result).toBe("string");
    expect(result).toBe("undefined");
  });

  it("strips INSERT SQL statements", () => {
    const result = sanitizeToolError(new Error("Failed: INSERT INTO users VALUES (1, 'test')"));
    expect(result).not.toContain("INSERT");
    expect(result).toContain("[sql]");
  });

  it("strips DELETE SQL statements", () => {
    const result = sanitizeToolError(new Error("Failed: DELETE FROM users WHERE id = 1"));
    expect(result).not.toContain("DELETE");
    expect(result).toContain("[sql]");
  });
});
