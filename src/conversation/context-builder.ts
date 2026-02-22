/**
 * Conversation Context Builder
 *
 * Implements a sliding-window approach (research Pattern 5) to build
 * conversation history within a token budget. Works backwards from the
 * most recent turn, accumulating until the budget is reached.
 *
 * Session boundary: 4 hours. Gaps longer than 4 hours between turns
 * indicate a new session; earlier turns are excluded.
 *
 * Output is an Anthropic MessageParam[] suitable for prepending to the
 * current user message in the messages array.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { estimateTokens } from "../knowledge/token-budget.js";
import type { ConversationTurn } from "./types.js";

/** 4 hours in milliseconds -- session boundary. */
const SESSION_GAP_MS = 4 * 60 * 60 * 1000;

/**
 * Result of building conversation context, including truncation metadata.
 * wasTruncated is true only when messages were dropped due to token budget
 * constraints (NOT session boundary gaps, which are intentional).
 */
export interface ConversationContextResult {
  messages: Anthropic.MessageParam[];
  wasTruncated: boolean;
  originalTurnCount: number;
  includedTurnCount: number;
}

/**
 * Build conversation context from historical turns within a token budget.
 *
 * @param turns - All turns for this chat, ordered by createdAt ascending
 * @param tokenBudget - Maximum estimated tokens for conversation history
 * @returns ConversationContextResult with messages and truncation metadata
 */
export function buildConversationContext(
  turns: ConversationTurn[],
  tokenBudget: number,
): ConversationContextResult {
  if (turns.length === 0) {
    return { messages: [], wasTruncated: false, originalTurnCount: 0, includedTurnCount: 0 };
  }

  // Exclude the most recent turn -- it's the current user message, handled separately
  const history = turns.slice(0, -1);
  if (history.length === 0) {
    return { messages: [], wasTruncated: false, originalTurnCount: 0, includedTurnCount: 0 };
  }

  const originalTurnCount = history.length;

  // Work backwards, applying session boundary and token budget
  const selected: ConversationTurn[] = [];
  let tokensUsed = 0;
  let truncatedByBudget = false;

  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];

    // Session boundary check: if there's a next (more recent) turn,
    // check the gap between this turn and the next one
    if (i < history.length - 1) {
      const nextTurn = history[i + 1];
      const gap = nextTurn.createdAt.getTime() - turn.createdAt.getTime();
      if (gap > SESSION_GAP_MS) {
        // This turn is from a previous session -- stop including
        break;
      }
    } else {
      // Check gap between last history turn and current message (last in turns)
      const currentMessage = turns[turns.length - 1];
      const gap = currentMessage.createdAt.getTime() - turn.createdAt.getTime();
      if (gap > SESSION_GAP_MS) {
        break;
      }
    }

    const turnTokens = estimateTokens(turn.text);
    if (tokensUsed + turnTokens > tokenBudget && selected.length > 0) {
      // Would exceed budget and we already have some history -- stop
      truncatedByBudget = true;
      break;
    }

    selected.unshift(turn);
    tokensUsed += turnTokens;
  }

  if (selected.length === 0) {
    return { messages: [], wasTruncated: truncatedByBudget, originalTurnCount, includedTurnCount: 0 };
  }

  // Drop leading assistant turn (Anthropic API requires user-first)
  if (selected[0].direction === "out") {
    selected.shift();
  }

  if (selected.length === 0) {
    return { messages: [], wasTruncated: truncatedByBudget, originalTurnCount, includedTurnCount: 0 };
  }

  // Merge consecutive same-role messages and build MessageParam array
  const params: Anthropic.MessageParam[] = [];
  let currentRole: "user" | "assistant" | null = null;
  let currentTexts: string[] = [];

  for (const turn of selected) {
    const role = turn.direction === "in" ? "user" : "assistant";

    if (role === currentRole) {
      // Same role as previous -- accumulate text
      currentTexts.push(turn.text);
    } else {
      // Different role -- flush previous
      if (currentRole !== null && currentTexts.length > 0) {
        params.push({
          role: currentRole,
          content: currentTexts.join("\n"),
        });
      }
      currentRole = role;
      currentTexts = [turn.text];
    }
  }

  // Flush last accumulated messages
  if (currentRole !== null && currentTexts.length > 0) {
    params.push({
      role: currentRole,
      content: currentTexts.join("\n"),
    });
  }

  return {
    messages: params,
    wasTruncated: truncatedByBudget,
    originalTurnCount,
    includedTurnCount: selected.length,
  };
}
