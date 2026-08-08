/**
 * Prompt cache breakpoint placement.
 *
 * Anthropic prompt caching is a PREFIX match: a cache entry exists only where a
 * `cache_control` marker is placed, and anything positioned ahead of volatile
 * content can never be reused. Render order is tools -> system -> messages, so
 * the prompt is laid out strictly by volatility:
 *
 *   tools                              stable
 *   system: persona + instructions     stable          <- breakpoint 1
 *   messages: prior turns              append-only     <- breakpoint 2 (here)
 *   messages: current turn             new every turn
 *     <session_context>...</session_context>
 *     the user's message
 *   messages: tool_use / tool_result   grows in-loop   <- breakpoint 3 (rolling)
 *
 * Per-request state (date, plan, grocery, memories) rides on the CURRENT turn
 * rather than in the system parameter. In `system` it sits ahead of every
 * message, so any change to it invalidates the entire conversation.
 *
 * The API allows four breakpoints per request; this module uses three and
 * rolls the in-loop one forward rather than accumulating markers.
 */

import type Anthropic from "@anthropic-ai/sdk";

/** The cache marker itself -- 5 minute TTL (the API default). */
export const CACHE_CONTROL = { type: "ephemeral" as const };

/** A content block that may carry a cache breakpoint. */
type Markable = Anthropic.ContentBlockParam & {
  cache_control?: typeof CACHE_CONTROL;
};

/** Normalize a message's content to block form so a marker can attach. */
function toBlocks(
  content: string | Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam[] {
  return typeof content === "string" ? [{ type: "text", text: content }] : [...content];
}

/**
 * Place the conversation breakpoint on the final content block of the last
 * history message.
 *
 * This is the marker that makes turn N read turns 1..N-1 from cache. It sits
 * BEFORE the current turn deliberately: history is rebuilt from stored plain
 * text each request, so everything up to this point is byte-identical from one
 * turn to the next, while the current turn is not.
 *
 * Returns a new array; the input is not mutated.
 */
export function withHistoryCacheBreakpoint(
  messages: Anthropic.MessageParam[],
): Anthropic.MessageParam[] {
  if (messages.length === 0) return [];

  const result = [...messages];
  const lastIndex = result.length - 1;
  const blocks = toBlocks(result[lastIndex].content);
  if (blocks.length === 0) return result;

  const last = blocks[blocks.length - 1] as Markable;

  // An empty text block is rejected by the API, so there is nothing to cache.
  if (last.type === "text" && !last.text.trim()) return result;

  // Cast: cache_control is valid on the block types that reach history (text,
  // image, tool_use, tool_result) but not on every arm of ContentBlockParam.
  blocks[blocks.length - 1] = {
    ...last,
    cache_control: CACHE_CONTROL,
  } as Anthropic.ContentBlockParam;
  result[lastIndex] = { ...result[lastIndex], content: blocks };
  return result;
}

/**
 * Build the current turn's content: per-request context first, then whatever
 * the user actually sent.
 *
 * Intentionally carries NO cache marker. The context block is not persisted to
 * the messages table, so this turn's bytes differ from how it will be replayed
 * as history next turn -- an entry here could never be read back.
 *
 * @param contextText - Rendered per-request state; omitted entirely when blank
 * @param userContent - The user's message, as text or content blocks (images)
 */
export function buildCurrentTurnContent(
  contextText: string,
  userContent: string | Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam[] {
  const blocks = toBlocks(userContent);
  if (!contextText.trim()) return blocks;

  return [
    {
      type: "text",
      text: `<session_context>\n${contextText.trim()}\n</session_context>`,
    },
    ...blocks,
  ];
}

/**
 * Roll the in-loop breakpoint forward onto the newest batch of tool results.
 *
 * Each agentic iteration re-sends every prior tool result, so without a marker
 * here iteration N reprocesses iterations 1..N-1 at full rate. The marker moves
 * rather than accumulating because only four breakpoints exist per request.
 *
 * Mutates the blocks in place -- they are already owned by the in-flight
 * message array.
 *
 * @param previous - The block marked on the last iteration, or null on the first
 * @param blocks - This iteration's tool result blocks
 * @returns The newly marked block, to pass back on the next iteration
 */
export function moveLoopCacheBreakpoint(
  previous: Anthropic.ContentBlockParam | null,
  blocks: Anthropic.ContentBlockParam[],
): Anthropic.ContentBlockParam | null {
  if (previous) delete (previous as Markable).cache_control;
  if (blocks.length === 0) return null;

  const last = blocks[blocks.length - 1] as Markable;
  last.cache_control = CACHE_CONTROL;
  return last;
}
