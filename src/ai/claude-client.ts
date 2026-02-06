import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./system-prompt.js";
import type { ClaudeResponse, TokenUsage } from "./types.js";
import { MODEL_PRICING } from "./types.js";

/**
 * Calculate estimated USD cost from token usage and model pricing.
 * Returns 0 for unknown models.
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) return 0;

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheWriteCost =
    (usage.cacheCreationInputTokens / 1_000_000) * pricing.cacheWritePerMTok;
  const cacheReadCost =
    (usage.cacheReadInputTokens / 1_000_000) * pricing.cacheReadPerMTok;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Create a Claude API client with the given credentials.
 *
 * Factory pattern matches existing codebase conventions (createDatabase, createBot).
 * maxRetries: 0 -- we handle retries ourselves for user-facing messaging.
 * timeout: 60_000 -- 60 second timeout per request.
 */
export function createClaudeClient(apiKey: string, model: string) {
  const client = new Anthropic({
    apiKey,
    maxRetries: 0,
    timeout: 60_000,
  });

  return {
    /**
     * Send a message to Claude and return the structured response.
     *
     * @param userMessages - Array of user message strings, joined with double newlines
     * @returns ClaudeResponse with text, usage, model, and stopReason
     */
    async sendMessage(userMessages: string[]): Promise<ClaudeResponse> {
      const systemPrompt = buildSystemPrompt();
      const combinedUserText = userMessages.join("\n\n");

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: [
          {
            type: "text" as const,
            text: systemPrompt,
            cache_control: { type: "ephemeral" as const },
          },
        ],
        messages: [{ role: "user" as const, content: combinedUserText }],
      });

      const textContent = response.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        )
        .map((block) => block.text)
        .join("\n");

      return {
        text: textContent,
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
          cacheCreationInputTokens:
            response.usage.cache_creation_input_tokens ?? 0,
          cacheReadInputTokens: response.usage.cache_read_input_tokens ?? 0,
        },
        model: response.model,
        stopReason: response.stop_reason ?? "unknown",
      };
    },
  };
}
