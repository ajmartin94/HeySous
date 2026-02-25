export interface ClaudeResponse {
  text: string;
  usage: TokenUsage;
  model: string;
  stopReason: string;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationInputTokens: number;
  cacheReadInputTokens: number;
}

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
}

/**
 * Result from a tool call handler, used in the processor's tool loop (Plan 03).
 * Maps a tool_use ID back to its string result for the tool_result block.
 */
export interface ToolHandlerResult {
  toolUseId: string;
  result: string;
}

// Claude model pricing per MTok (USD)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Haiku 4.5
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
  },
  // Sonnet 4
  "claude-sonnet-4-20250514": {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.3,
  },
  // Sonnet 4.6
  "claude-sonnet-4-6": {
    inputPerMTok: 3.0,
    outputPerMTok: 15.0,
    cacheWritePerMTok: 3.75,
    cacheReadPerMTok: 0.3,
  },
  // Opus 4
  "claude-opus-4-20250514": {
    inputPerMTok: 15.0,
    outputPerMTok: 75.0,
    cacheWritePerMTok: 18.75,
    cacheReadPerMTok: 1.5,
  },
  // Opus 4.6
  "claude-opus-4-6": {
    inputPerMTok: 5.0,
    outputPerMTok: 25.0,
    cacheWritePerMTok: 6.25,
    cacheReadPerMTok: 0.5,
  },
  // Fallback for unknown models -- use Haiku pricing as conservative baseline
  _fallback: {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
  },
};
