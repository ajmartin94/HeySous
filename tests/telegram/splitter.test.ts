import { describe, it, expect } from "vitest";
import { splitMessage } from "../../src/telegram/splitter.js";

describe("splitMessage", () => {
  it("returns single-element array for short text", () => {
    expect(splitMessage("hello")).toEqual(["hello"]);
  });

  it("returns [''] for empty string", () => {
    expect(splitMessage("")).toEqual([""]);
  });

  it("returns single element for text exactly at limit", () => {
    const text = "a".repeat(4096);
    expect(splitMessage(text)).toEqual([text]);
  });

  it("splits at paragraph boundary (double newline) when available", () => {
    const paragraph1 = "a".repeat(2000);
    const paragraph2 = "b".repeat(2000);
    const paragraph3 = "c".repeat(1000);
    const text = `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
    const chunks = splitMessage(text);
    expect(chunks.length).toBeGreaterThan(1);
    // First chunk should contain paragraph1 content
    expect(chunks[0]).toContain(paragraph1);
    // No chunk should exceed 4096
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
    // All content should be preserved (joined without delimiters may lose the \n\n)
    const rejoined = chunks.join("\n\n");
    expect(rejoined).toContain(paragraph1);
    expect(rejoined).toContain(paragraph2);
    expect(rejoined).toContain(paragraph3);
  });

  it("splits at line break when no paragraph boundary fits", () => {
    // Create text where the only break point within limit is a single \n
    const line1 = "a".repeat(3000);
    const line2 = "b".repeat(3000);
    const text = `${line1}\n${line2}`;
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(line1);
    expect(chunks[1]).toBe(line2);
  });

  it("splits at sentence boundary when no line break available", () => {
    // Create text with no newlines but with sentence boundaries
    const sentence1 = "a".repeat(3000);
    const sentence2 = "b".repeat(3000);
    const text = `${sentence1}. ${sentence2}`;
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(`${sentence1}.`);
    expect(chunks[1]).toBe(sentence2);
  });

  it("splits at word boundary when no sentence end available", () => {
    // Create text with only spaces as boundaries
    const word1 = "a".repeat(3000);
    const word2 = "b".repeat(3000);
    const text = `${word1} ${word2}`;
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe(word1);
    expect(chunks[1]).toBe(word2);
  });

  it("hard cuts as last resort (no spaces at all)", () => {
    const text = "a".repeat(5000);
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(2);
    expect(chunks[0]).toBe("a".repeat(4096));
    expect(chunks[1]).toBe("a".repeat(904));
  });

  it("enforces split point at least 30% into chunk", () => {
    // Put a paragraph boundary very early (at 10%), then nothing until past limit
    const earlyBreak = "a".repeat(100);
    const restOfText = "b".repeat(5000);
    const text = `${earlyBreak}\n\n${restOfText}`;
    const chunks = splitMessage(text);
    // Should NOT split at the early paragraph boundary (only 100 chars, well under 30% of 4096)
    // Instead should find another boundary or hard cut
    expect(chunks[0].length).toBeGreaterThanOrEqual(Math.floor(4096 * 0.3));
  });

  it("trims leading and trailing whitespace from each chunk", () => {
    const part1 = "a".repeat(3000);
    const part2 = "b".repeat(3000);
    // Extra spaces around the split point
    const text = `${part1}   \n\n   ${part2}`;
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      expect(chunk).toBe(chunk.trim());
    }
  });

  it("handles 3-way split for text with multiple paragraphs exceeding 2x limit", () => {
    const p1 = "a".repeat(3000);
    const p2 = "b".repeat(4000);
    const p3 = "c".repeat(1000);
    const text = `${p1}\n\n${p2}\n\n${p3}`;
    // Total: ~8006 chars
    const chunks = splitMessage(text);
    expect(chunks.length).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(4096);
    }
  });

  it("works with custom maxLength parameter", () => {
    const text = "hello world this is a test of splitting";
    const chunks = splitMessage(text, 20);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(chunk.length).toBeLessThanOrEqual(20);
    }
  });

  it("produces no empty chunks", () => {
    const p1 = "a".repeat(2000);
    const p2 = "b".repeat(2000);
    const p3 = "c".repeat(2000);
    const text = `${p1}\n\n${p2}\n\n${p3}`;
    const chunks = splitMessage(text);
    for (const chunk of chunks) {
      expect(chunk.length).toBeGreaterThan(0);
    }
  });
});
