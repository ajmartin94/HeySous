import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import {
  buildCurrentTurnContent,
  moveLoopCacheBreakpoint,
  withHistoryCacheBreakpoint,
} from "../../src/ai/prompt-cache.js";

/** Pull the cache_control marker off a content block, if present. */
function marker(block: unknown): unknown {
  return (block as { cache_control?: unknown }).cache_control;
}

function lastBlockOf(message: Anthropic.MessageParam): unknown {
  const content = message.content as Anthropic.ContentBlockParam[];
  return content[content.length - 1];
}

describe("withHistoryCacheBreakpoint", () => {
  /**
   * Without a breakpoint here the cached region ends at the system prompt and
   * every prior turn is reprocessed at full input rate on every request. This
   * marker is what lets turn N read turns 1..N-1 from cache.
   */
  it("marks the final content block of the last history message", () => {
    const result = withHistoryCacheBreakpoint([
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
    ]);

    expect(marker(lastBlockOf(result[1]))).toEqual({ type: "ephemeral" });
  });

  it("marks only the last message, leaving earlier ones untouched", () => {
    const result = withHistoryCacheBreakpoint([
      { role: "user", content: "first" },
      { role: "assistant", content: "second" },
    ]);

    expect(marker(lastBlockOf(result[0]))).toBeUndefined();
  });

  it("normalizes string content to a text block so the marker can attach", () => {
    const result = withHistoryCacheBreakpoint([{ role: "user", content: "hello" }]);

    expect(result[0].content).toEqual([
      { type: "text", text: "hello", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("marks the last block when content is already an array", () => {
    const result = withHistoryCacheBreakpoint([
      {
        role: "user",
        content: [
          { type: "text", text: "a" },
          { type: "text", text: "b" },
        ],
      },
    ]);

    const content = result[0].content as Anthropic.ContentBlockParam[];
    expect(marker(content[0])).toBeUndefined();
    expect(marker(content[1])).toEqual({ type: "ephemeral" });
  });

  it("does not mutate the messages it was given", () => {
    const original: Anthropic.MessageParam[] = [{ role: "user", content: "hello" }];
    withHistoryCacheBreakpoint(original);

    expect(original[0].content).toBe("hello");
  });

  it("returns an empty history unchanged", () => {
    expect(withHistoryCacheBreakpoint([])).toEqual([]);
  });

  /** An empty text block is rejected by the API, so there is nothing to mark. */
  it("leaves a message with no text untouched", () => {
    const result = withHistoryCacheBreakpoint([{ role: "user", content: "" }]);
    expect(result[0].content).toBe("");
  });
});

describe("buildCurrentTurnContent", () => {
  /**
   * Per-request state must ride on the newest turn. In the system parameter it
   * sits ahead of every message, so each change invalidates the whole
   * conversation prefix.
   */
  it("puts session context ahead of the user's message", () => {
    const content = buildCurrentTurnContent("plan: tacos", "what's for dinner?");

    expect(content[0]).toMatchObject({ type: "text" });
    expect((content[0] as { text: string }).text).toContain("plan: tacos");
    expect((content[0] as { text: string }).text).toContain("<session_context>");
    expect(content[1]).toEqual({ type: "text", text: "what's for dinner?" });
  });

  it("omits the context block entirely when there is no context", () => {
    expect(buildCurrentTurnContent("", "hello")).toEqual([
      { type: "text", text: "hello" },
    ]);
  });

  it("omits the context block when context is only whitespace", () => {
    expect(buildCurrentTurnContent("  \n ", "hello")).toEqual([
      { type: "text", text: "hello" },
    ]);
  });

  it("preserves image blocks and keeps context first", () => {
    const image: Anthropic.ContentBlockParam = {
      type: "image",
      source: { type: "base64", media_type: "image/png", data: "xyz" },
    };
    const content = buildCurrentTurnContent("ctx", [image, { type: "text", text: "read this" }]);

    expect(content).toHaveLength(3);
    expect((content[0] as { text: string }).text).toContain("ctx");
    expect(content[1]).toEqual(image);
  });

  it("carries no cache marker -- this turn's bytes differ from next turn's history", () => {
    // History is rebuilt from stored plain text, so the context block never
    // reappears. Marking it would create an entry that can never be re-read.
    const content = buildCurrentTurnContent("ctx", "hi");
    for (const block of content) {
      expect(marker(block)).toBeUndefined();
    }
  });
});

describe("moveLoopCacheBreakpoint", () => {
  /**
   * Only four breakpoints exist per request, so the in-loop marker has to roll
   * forward rather than accumulate -- otherwise a long tool loop exhausts the
   * budget and later iterations silently stop caching.
   */
  it("marks the last block of the newest batch", () => {
    const blocks: Anthropic.ContentBlockParam[] = [
      { type: "text", text: "a" },
      { type: "text", text: "b" },
    ];

    const marked = moveLoopCacheBreakpoint(null, blocks);

    expect(marker(blocks[1])).toEqual({ type: "ephemeral" });
    expect(marked).toBe(blocks[1]);
  });

  it("clears the previous marker when moving forward", () => {
    const first: Anthropic.ContentBlockParam[] = [{ type: "text", text: "a" }];
    const second: Anthropic.ContentBlockParam[] = [{ type: "text", text: "b" }];

    const afterFirst = moveLoopCacheBreakpoint(null, first);
    moveLoopCacheBreakpoint(afterFirst, second);

    expect(marker(first[0])).toBeUndefined();
    expect(marker(second[0])).toEqual({ type: "ephemeral" });
  });

  it("returns null and clears the old marker when the batch is empty", () => {
    const first: Anthropic.ContentBlockParam[] = [{ type: "text", text: "a" }];
    const afterFirst = moveLoopCacheBreakpoint(null, first);

    expect(moveLoopCacheBreakpoint(afterFirst, [])).toBeNull();
    expect(marker(first[0])).toBeUndefined();
  });
});
