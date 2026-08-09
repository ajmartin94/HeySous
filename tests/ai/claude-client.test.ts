import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Captured request bodies from the mocked Anthropic SDK, in call order.
 * Streaming and non-streaming calls land in separate arrays so each path
 * can be asserted independently.
 */
const createCalls: Record<string, unknown>[] = [];
const streamCalls: Record<string, unknown>[] = [];

/** Queue of responses the mock returns, one per call. */
let responseQueue: unknown[] = [];

function nextResponse(): unknown {
  const response = responseQueue.shift();
  if (!response) throw new Error("mock ran out of queued responses");
  return response;
}

vi.mock("@anthropic-ai/sdk", () => {
  class MockAnthropic {
    messages = {
      create: (body: Record<string, unknown>) => {
        createCalls.push(body);
        return Promise.resolve(nextResponse());
      },
      stream: (body: Record<string, unknown>) => {
        streamCalls.push(body);
        const message = nextResponse();
        return {
          on: () => {},
          finalMessage: () => Promise.resolve(message),
        };
      },
    };
  }
  return {
    default: MockAnthropic,
    APIError: class APIError extends Error {},
  };
});

const { createClaudeClient, calculateCost } = await import("../../src/ai/claude-client.js");

const TOOLS = [
  {
    name: "save_grocery_list",
    description: "d",
    input_schema: { type: "object" as const, properties: {} },
  },
];

/** A response that ends the loop cleanly. */
function endTurn(text: string) {
  return {
    content: text ? [{ type: "text", text }] : [],
    stop_reason: "end_turn",
    model: "claude-sonnet-5",
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

/** A response requesting one tool call, which keeps the loop going. */
function toolUse(name: string) {
  return {
    content: [{ type: "tool_use", id: `t-${name}`, name, input: {} }],
    stop_reason: "tool_use",
    model: "claude-sonnet-5",
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

beforeEach(() => {
  createCalls.length = 0;
  streamCalls.length = 0;
  responseQueue = [];
});

describe("claude-client request shape", () => {
  it("sends a max_tokens ceiling with headroom for thinking", async () => {
    // Sonnet 5 thinks by default and thinking shares the max_tokens budget.
    // The old hardcoded 2048 was spent on reasoning, truncating the answer.
    responseQueue = [endTurn("hi")];
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.streamMessageWithTools([], TOOLS, () => "", {});

    expect(streamCalls[0].max_tokens).toBeGreaterThanOrEqual(16_000);
  });

  it("applies the same ceiling on the non-streaming path", async () => {
    responseQueue = [endTurn("hi")];
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.sendMessageWithTools([], TOOLS, () => "");

    expect(createCalls[0].max_tokens).toBeGreaterThanOrEqual(16_000);
  });
});

describe("forced final response after iteration exhaustion", () => {
  /** Fill the loop with tool calls so it runs out of iterations. */
  function exhaust(iterations: number) {
    responseQueue = [
      ...Array.from({ length: iterations }, () => toolUse("save_grocery_list")),
      endTurn("final answer"),
    ];
  }

  it("keeps tools on the request and forbids their use, rather than dropping them", async () => {
    // The API rejects a request whose messages carry tool_use/tool_result
    // blocks when `tools` is absent, so dropping tools made the safety net
    // throw every time instead of forcing a text response.
    exhaust(2);
    const client = createClaudeClient("k", "claude-sonnet-5");

    const result = await client.streamMessageWithTools(
      [],
      TOOLS,
      () => "{}",
      {},
      2,
    );

    const finalCall = streamCalls[streamCalls.length - 1];
    expect(finalCall.tools).toEqual(TOOLS);
    expect(finalCall.tool_choice).toEqual({ type: "none" });
    expect(result.text).toBe("final answer");
  });

  it("does the same on the non-streaming path", async () => {
    exhaust(2);
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.sendMessageWithTools([], TOOLS, () => "{}", 2);

    const finalCall = createCalls[createCalls.length - 1];
    expect(finalCall.tools).toEqual(TOOLS);
    expect(finalCall.tool_choice).toEqual({ type: "none" });
  });
});

describe("truncated responses", () => {
  it("reports max_tokens truncation instead of returning silent empty text", async () => {
    // The failure users saw: the whole budget went to thinking, the turn ended
    // with no text and no tool call, and the loop returned "" with no error --
    // so the bot appeared to say nothing at all.
    responseQueue = [
      {
        content: [{ type: "thinking", thinking: "", signature: "s" }],
        stop_reason: "max_tokens",
        model: "claude-sonnet-5",
        usage: { input_tokens: 1, output_tokens: 2048 },
      },
    ];
    const client = createClaudeClient("k", "claude-sonnet-5");

    const result = await client.streamMessageWithTools([], TOOLS, () => "", {});

    expect(result.stopReason).toBe("max_tokens");
    expect(result.truncated).toBe(true);
  });

  it("does not flag a normal completion as truncated", async () => {
    responseQueue = [endTurn("all good")];
    const client = createClaudeClient("k", "claude-sonnet-5");

    const result = await client.streamMessageWithTools([], TOOLS, () => "", {});

    expect(result.truncated).toBeFalsy();
    expect(result.text).toBe("all good");
  });
});

describe("calculateCost", () => {
  const usage = {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };

  /**
   * claude-sonnet-5 had no entry, so from the 2026-07-23 model switch onward
   * every cost row silently fell back to Haiku rates and under-reported spend
   * by ~2x. Prices here are standard (not introductory), so the figure is
   * never an understatement.
   */
  it("prices claude-sonnet-5 from its own entry, not the fallback", () => {
    expect(calculateCost("claude-sonnet-5", usage)).toBeCloseTo(3 + 15, 5);
  });

  it("prices claude-opus-5 from its own entry", () => {
    expect(calculateCost("claude-opus-5", usage)).toBeCloseTo(5 + 25, 5);
  });

  /**
   * The fallback used to be Haiku -- the CHEAPEST model -- described as a
   * "conservative baseline". It is the opposite: an unknown model must
   * over-report, never under-report, or a pricing gap hides real spend.
   */
  it("falls back to the most expensive rates, never the cheapest", () => {
    const fallback = calculateCost("some-unreleased-model", usage);
    const knownCosts = ["claude-haiku-4-5-20251001", "claude-sonnet-5", "claude-opus-5"]
      .map((m) => calculateCost(m, usage));

    for (const known of knownCosts) {
      expect(fallback).toBeGreaterThanOrEqual(known);
    }
  });

  it("charges cache reads far below input tokens", () => {
    const cacheRead = calculateCost("claude-sonnet-5", {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 1_000_000,
    });
    const input = calculateCost("claude-sonnet-5", {
      inputTokens: 1_000_000,
      outputTokens: 0,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 0,
    });
    expect(cacheRead).toBeLessThan(input);
  });
});

describe("cache breakpoints on the wire", () => {
  /** Count cache_control markers across every content block of a request. */
  function countMarkers(body: Record<string, unknown>): number {
    const messages = (body.messages ?? []) as { content: unknown }[];
    let n = 0;
    for (const message of messages) {
      if (!Array.isArray(message.content)) continue;
      for (const block of message.content as { cache_control?: unknown }[]) {
        if (block.cache_control) n++;
      }
    }
    return n;
  }

  it("sends the system prompt as a single cached block", async () => {
    responseQueue = [endTurn("hi")];
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.streamMessageWithTools([], TOOLS, () => "", {}, 5, "STABLE PROMPT");

    expect(streamCalls[0].system).toEqual([
      { type: "text", text: "STABLE PROMPT", cache_control: { type: "ephemeral" } },
    ]);
  });

  it("rolls the in-loop marker forward instead of accumulating markers", async () => {
    // Only four breakpoints exist per request. If each iteration added one, a
    // long tool loop would exhaust the budget and later iterations would stop
    // caching entirely.
    responseQueue = [
      toolUse("save_grocery_list"),
      toolUse("save_grocery_list"),
      toolUse("save_grocery_list"),
      endTurn("done"),
    ];
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.streamMessageWithTools([], TOOLS, () => "{}", {}, 5);

    // By the final request three tool-result batches are in the array, but only
    // the newest carries a marker.
    const lastCall = streamCalls[streamCalls.length - 1];
    expect(countMarkers(lastCall)).toBe(1);
  });

  it("marks the newest tool results, not the oldest", async () => {
    responseQueue = [toolUse("a"), toolUse("b"), endTurn("done")];
    const client = createClaudeClient("k", "claude-sonnet-5");

    await client.streamMessageWithTools([], TOOLS, () => "{}", {}, 5);

    const messages = (streamCalls[streamCalls.length - 1].messages ?? []) as { role: string; content: unknown }[];
    const toolResultMessages = messages.filter(
      (m) => Array.isArray(m.content) &&
        (m.content as { type?: string }[]).some((b) => b.type === "tool_result"),
    );
    const marked = toolResultMessages.map((m) =>
      (m.content as { cache_control?: unknown }[]).some((b) => b.cache_control),
    );
    expect(marked).toEqual([false, true]);
  });
});
