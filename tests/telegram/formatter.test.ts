import { describe, it, expect } from "vitest";
import { escapeHtml, formatBotResponse } from "../../src/telegram/formatter.js";

describe("escapeHtml", () => {
  it("escapes ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("escapes less-than signs", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes greater-than signs", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;");
  });

  it("escapes combined special characters", () => {
    expect(escapeHtml("Hello <world> & \"friends\"")).toBe(
      "Hello &lt;world&gt; &amp; &quot;friends&quot;"
    );
  });

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("");
  });

  it("returns string with no special chars unchanged", () => {
    expect(escapeHtml("plain text")).toBe("plain text");
  });
});

describe("formatBotResponse", () => {
  it("preserves supported bold tags", () => {
    expect(formatBotResponse("<b>bold</b>")).toBe("<b>bold</b>");
  });

  it("preserves supported strong tags", () => {
    expect(formatBotResponse("<strong>bold</strong>")).toBe(
      "<strong>bold</strong>"
    );
  });

  it("preserves supported italic tags", () => {
    expect(formatBotResponse("<i>italic</i>")).toBe("<i>italic</i>");
  });

  it("preserves supported em tags", () => {
    expect(formatBotResponse("<em>emphasis</em>")).toBe("<em>emphasis</em>");
  });

  it("preserves supported underline tags", () => {
    expect(formatBotResponse("<u>underline</u>")).toBe("<u>underline</u>");
  });

  it("preserves supported ins tags", () => {
    expect(formatBotResponse("<ins>inserted</ins>")).toBe(
      "<ins>inserted</ins>"
    );
  });

  it("preserves supported strikethrough tags", () => {
    expect(formatBotResponse("<s>strike</s>")).toBe("<s>strike</s>");
    expect(formatBotResponse("<strike>strike</strike>")).toBe(
      "<strike>strike</strike>"
    );
    expect(formatBotResponse("<del>deleted</del>")).toBe("<del>deleted</del>");
  });

  it("preserves anchor tags", () => {
    expect(formatBotResponse('<a href="https://example.com">link</a>')).toBe(
      '<a href="https://example.com">link</a>'
    );
  });

  it("preserves code tags", () => {
    expect(formatBotResponse("<code>inline</code>")).toBe(
      "<code>inline</code>"
    );
  });

  it("preserves pre tags", () => {
    expect(formatBotResponse("<pre>block</pre>")).toBe("<pre>block</pre>");
  });

  it("strips unsupported div tags", () => {
    expect(formatBotResponse("<div>text</div>")).toBe("text");
  });

  it("strips unsupported span tags", () => {
    expect(formatBotResponse("<span>text</span>")).toBe("text");
  });

  it("strips unsupported p tags", () => {
    expect(formatBotResponse("<p>paragraph</p>")).toBe("paragraph");
  });

  it("strips unsupported h1 tags", () => {
    expect(formatBotResponse("<h1>heading</h1>")).toBe("heading");
  });

  it("replaces br tags with newlines", () => {
    expect(formatBotResponse("line1<br>line2")).toBe("line1\nline2");
    expect(formatBotResponse("line1<br/>line2")).toBe("line1\nline2");
    expect(formatBotResponse("line1<br />line2")).toBe("line1\nline2");
  });

  it("handles nested supported tags", () => {
    expect(formatBotResponse("<b><i>text</i></b>")).toBe(
      "<b><i>text</i></b>"
    );
  });

  it("strips unsupported tags but preserves supported nested inside", () => {
    expect(formatBotResponse("<div><b>bold</b> text</div>")).toBe(
      "<b>bold</b> text"
    );
  });

  it("returns empty string unchanged", () => {
    expect(formatBotResponse("")).toBe("");
  });

  it("handles self-closing unsupported tags", () => {
    expect(formatBotResponse("before<hr/>after")).toBe("beforeafter");
  });
});
