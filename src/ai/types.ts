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

// Haiku 4.5 pricing per MTok (USD)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1.0,
    outputPerMTok: 5.0,
    cacheWritePerMTok: 1.25,
    cacheReadPerMTok: 0.1,
  },
};
