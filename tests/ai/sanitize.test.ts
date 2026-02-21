import { describe, it, expect, vi } from "vitest";
import { sanitizeForPrompt, sanitizeAndLog } from "../../src/ai/sanitize.js";
import type { Logger } from "pino";

describe("sanitizeForPrompt", () => {
  it("passes plain text through unchanged", () => {
    expect(sanitizeForPrompt("John")).toBe("John");
    expect(sanitizeForPrompt("Hello World")).toBe("Hello World");
  });

  it("strips simple HTML tags", () => {
    expect(sanitizeForPrompt("<b>John</b>")).toBe("John");
  });

  it("strips script tags", () => {
    expect(sanitizeForPrompt("<script>alert(1)</script>")).toBe("alert(1)");
  });

  it("strips nested and malformed HTML", () => {
    expect(sanitizeForPrompt("<b><i>text</i></b>")).toBe("text");
  });

  it("strips HTML tags with attributes", () => {
    expect(sanitizeForPrompt('<a href="http://evil.com">click</a>')).toBe(
      "click",
    );
    expect(
      sanitizeForPrompt('<div class="foo" id="bar">content</div>'),
    ).toBe("content");
  });

  it("strips self-closing tags", () => {
    expect(sanitizeForPrompt("before<br/>after")).toBe("beforeafter");
    expect(sanitizeForPrompt("before<img src='x'/>after")).toBe("beforeafter");
  });

  it("strips null bytes", () => {
    expect(sanitizeForPrompt("hello\0world")).toBe("helloworld");
    expect(sanitizeForPrompt("\0\0test\0")).toBe("test");
  });

  it("strips ANSI escape sequences", () => {
    expect(sanitizeForPrompt("\x1B[31mred\x1B[0m")).toBe("red");
    expect(sanitizeForPrompt("\x1B[1;32mbold green\x1B[0m")).toBe(
      "bold green",
    );
  });

  it("handles mixed HTML and control characters", () => {
    expect(sanitizeForPrompt("<b>\x1B[31mhello\0</b>")).toBe("hello");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeForPrompt("")).toBe("");
  });

  it("returns empty string for string with only tags", () => {
    expect(sanitizeForPrompt("<b></b>")).toBe("");
    expect(sanitizeForPrompt("<div><span></span></div>")).toBe("");
  });

  it("preserves normal cooking-related text", () => {
    expect(sanitizeForPrompt("2 cups flour, 1 tsp salt")).toBe(
      "2 cups flour, 1 tsp salt",
    );
    expect(sanitizeForPrompt("Chicken Parmesan (family recipe)")).toBe(
      "Chicken Parmesan (family recipe)",
    );
  });

  it("preserves unicode characters and emoji", () => {
    expect(sanitizeForPrompt("Creme brulee")).toBe("Creme brulee");
    expect(sanitizeForPrompt("Sauteed mushrooms")).toBe("Sauteed mushrooms");
    expect(sanitizeForPrompt("Jose's Kitchen")).toBe("Jose's Kitchen");
  });

  it("preserves emoji", () => {
    expect(sanitizeForPrompt("Pizza night! 🍕")).toBe("Pizza night! 🍕");
    expect(sanitizeForPrompt("🥗 Salad lover")).toBe("🥗 Salad lover");
  });

  it("preserves accented characters", () => {
    expect(sanitizeForPrompt("creme brulee")).toBe("creme brulee");
    expect(sanitizeForPrompt("Jalapeno peppers")).toBe("Jalapeno peppers");
  });
});

describe("sanitizeAndLog", () => {
  function createMockLogger(): Logger {
    return {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    } as unknown as Logger;
  }

  it("returns sanitized text", () => {
    const logger = createMockLogger();
    expect(sanitizeAndLog("<b>John</b>", "userName", logger)).toBe("John");
  });

  it("logs when sanitization modifies input", () => {
    const logger = createMockLogger();
    sanitizeAndLog("<b>John</b>", "userName", logger);

    expect(logger.info).toHaveBeenCalledWith(
      {
        field: "userName",
        originalLength: 11,
        sanitizedLength: 4,
        event: "prompt_sanitization",
      },
      "Sanitized user input for prompt",
    );
  });

  it("does not log when input is already clean", () => {
    const logger = createMockLogger();
    sanitizeAndLog("John", "userName", logger);

    expect(logger.info).not.toHaveBeenCalled();
  });

  it("includes field name in log entry", () => {
    const logger = createMockLogger();
    sanitizeAndLog("<script>x</script>", "preference.title", logger);

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({ field: "preference.title" }),
      expect.any(String),
    );
  });
});
