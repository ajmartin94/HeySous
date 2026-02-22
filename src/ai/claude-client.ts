import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "./system-prompt.js";
import type { ClaudeResponse, TokenUsage } from "./types.js";
import { MODEL_PRICING } from "./types.js";

/**
 * System prompt input -- either a single string (backward compatible) or
 * a static/dynamic split for two-block prompt caching.
 *
 * When an object is provided:
 * - static: Stable instruction content, cached via cache_control
 * - dynamic: Per-request context (preferences, plans, etc.), NOT cached
 */
export type SystemPromptInput = string | { static: string; dynamic: string };

/**
 * Build Anthropic system content blocks from a SystemPromptInput.
 *
 * - String input: single block with cache_control (backward compatible)
 * - Object input: two blocks -- static with cache_control, dynamic without
 */
function buildSystemBlocks(input: SystemPromptInput): Anthropic.TextBlockParam[] {
  if (typeof input === "string") {
    return [
      {
        type: "text" as const,
        text: input,
        cache_control: { type: "ephemeral" as const },
      },
    ];
  }
  return [
    {
      type: "text" as const,
      text: input.static,
      cache_control: { type: "ephemeral" as const },
    },
    {
      type: "text" as const,
      text: input.dynamic,
    },
  ];
}

/**
 * Calculate estimated USD cost from token usage and model pricing.
 * Returns 0 for unknown models.
 */
export function calculateCost(model: string, usage: TokenUsage): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING._fallback;
  if (!pricing) return 0; // defensive -- _fallback should always exist

  const inputCost = (usage.inputTokens / 1_000_000) * pricing.inputPerMTok;
  const outputCost = (usage.outputTokens / 1_000_000) * pricing.outputPerMTok;
  const cacheWriteCost =
    (usage.cacheCreationInputTokens / 1_000_000) * pricing.cacheWritePerMTok;
  const cacheReadCost =
    (usage.cacheReadInputTokens / 1_000_000) * pricing.cacheReadPerMTok;

  return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

/**
 * Sanitize an error message before returning it to Claude via tool_result.
 * Strips stack traces, file paths, and SQL statements so no internal
 * implementation details leak to the LLM.
 */
export function sanitizeToolError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  // Strip stack traces, file paths, and SQL from the message
  const sanitized = raw
    .replace(/\s+at\s+.+/g, "")           // stack trace lines
    .replace(/\/[\w/.-]+\.\w+/g, "[path]") // file paths like /src/foo/bar.ts
    .replace(/(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+.*/gi, "[sql]") // SQL statements
    .trim();
  return sanitized || "An internal error occurred";
}

/** Default max tool use iterations before forcing a text response. */
const DEFAULT_MAX_ITERATIONS = 5;

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
     * Simple single-turn call without tool support (backward compatible).
     *
     * @param userMessages - Array of user message strings, joined with double newlines
     * @returns ClaudeResponse with text, usage, model, and stopReason
     */
    async sendMessage(
      userMessages: string[],
      systemPrompt?: SystemPromptInput,
    ): Promise<ClaudeResponse> {
      const prompt = systemPrompt ?? buildSystemPrompt();
      const systemBlocks = buildSystemBlocks(prompt);
      const combinedUserText = userMessages.join("\n\n");

      const response = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemBlocks,
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

    /**
     * Send a message to Claude with tool support and automatic tool use loop.
     *
     * Implements the manual tool use loop per research Pattern 1:
     * 1. Call Claude with messages and tools
     * 2. If stop_reason is "end_turn", extract text and return
     * 3. If response has tool_use blocks, call onToolCall for each
     * 4. Append assistant response + tool_results to messages
     * 5. Loop back to (1) until max iterations
     * 6. Safety: if max iterations reached, do one final call WITHOUT tools
     *
     * Token usage is aggregated across all iterations.
     *
     * @param messages - Full message array including conversation history
     * @param tools - Anthropic tool definitions
     * @param onToolCall - Callback to handle tool calls (sync or async)
     * @param maxIterations - Maximum tool use iterations (default 5)
     * @returns ClaudeResponse with aggregated usage from all iterations
     */
    async sendMessageWithTools(
      messages: Anthropic.MessageParam[],
      tools: Anthropic.Tool[],
      onToolCall: (name: string, input: Record<string, unknown>) => string | Promise<string>,
      maxIterations: number = DEFAULT_MAX_ITERATIONS,
      systemPrompt?: SystemPromptInput,
    ): Promise<ClaudeResponse> {
      const prompt = systemPrompt ?? buildSystemPrompt();
      const systemBlock = buildSystemBlocks(prompt);

      // Aggregate token usage across all iterations
      const totalUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      };

      // Mutable copy of messages for the loop
      const loopMessages: Anthropic.MessageParam[] = [...messages];
      let finalModel = model;
      let finalStopReason = "unknown";

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response = await client.messages.create({
          model,
          max_tokens: 2048,
          system: systemBlock,
          messages: loopMessages,
          tools,
        });

        // Aggregate usage
        totalUsage.inputTokens += response.usage.input_tokens;
        totalUsage.outputTokens += response.usage.output_tokens;
        totalUsage.cacheCreationInputTokens +=
          response.usage.cache_creation_input_tokens ?? 0;
        totalUsage.cacheReadInputTokens +=
          response.usage.cache_read_input_tokens ?? 0;

        finalModel = response.model;
        finalStopReason = response.stop_reason ?? "unknown";

        // Check if Claude is done (no tool use)
        if (response.stop_reason === "end_turn") {
          const textContent = response.content
            .filter(
              (block): block is Anthropic.TextBlock => block.type === "text",
            )
            .map((block) => block.text)
            .join("\n");

          return {
            text: textContent,
            usage: totalUsage,
            model: finalModel,
            stopReason: finalStopReason,
          };
        }

        // Extract tool_use blocks
        const toolUseBlocks = response.content.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
        );

        if (toolUseBlocks.length === 0) {
          // No tool use and not end_turn -- extract text and return
          const textContent = response.content
            .filter(
              (block): block is Anthropic.TextBlock => block.type === "text",
            )
            .map((block) => block.text)
            .join("\n");

          return {
            text: textContent,
            usage: totalUsage,
            model: finalModel,
            stopReason: finalStopReason,
          };
        }

        // Handle tool calls (with error resilience -- catch exceptions and return is_error)
        const toolResults: Anthropic.ToolResultBlockParam[] =
          await Promise.all(toolUseBlocks.map(async (block) => {
            try {
              const result = await onToolCall(
                block.name,
                block.input as Record<string, unknown>,
              );
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: result,
              };
            } catch (error) {
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: JSON.stringify({ error: sanitizeToolError(error) }),
                is_error: true,
              };
            }
          }));

        // Append assistant response + all tool results in ONE user message
        // (per research pitfall 3: all tool_results immediately after assistant)
        loopMessages.push({
          role: "assistant" as const,
          content: response.content,
        });
        loopMessages.push({
          role: "user" as const,
          content: toolResults,
        });
      }

      // Max iterations reached -- do one final call WITHOUT tools to force text response
      const finalResponse = await client.messages.create({
        model,
        max_tokens: 2048,
        system: systemBlock,
        messages: loopMessages,
      });

      totalUsage.inputTokens += finalResponse.usage.input_tokens;
      totalUsage.outputTokens += finalResponse.usage.output_tokens;
      totalUsage.cacheCreationInputTokens +=
        finalResponse.usage.cache_creation_input_tokens ?? 0;
      totalUsage.cacheReadInputTokens +=
        finalResponse.usage.cache_read_input_tokens ?? 0;

      const textContent = finalResponse.content
        .filter(
          (block): block is Anthropic.TextBlock => block.type === "text",
        )
        .map((block) => block.text)
        .join("\n");

      return {
        text: textContent,
        usage: totalUsage,
        model: finalResponse.model,
        stopReason: finalResponse.stop_reason ?? "unknown",
      };
    },
  };
}
