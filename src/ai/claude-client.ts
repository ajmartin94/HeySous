import Anthropic from "@anthropic-ai/sdk";
import { APIError } from "@anthropic-ai/sdk";
import type { Logger } from "pino";
import { AI } from "../config.js";
import { CACHE_CONTROL, moveLoopCacheBreakpoint } from "./prompt-cache.js";
import { buildSystemPrompt } from "./system-prompt.js";
import type { ClaudeResponse, TokenUsage } from "./types.js";
import { MODEL_PRICING } from "./types.js";

/**
 * The system prompt. Stable instruction content only.
 *
 * Per-request state does NOT belong here: the system parameter renders ahead of
 * every message, so anything volatile in it invalidates the whole conversation
 * for caching. That content rides on the current user turn instead -- see
 * prompt-cache.ts.
 */
export type SystemPromptInput = string;

/**
 * Build the system parameter as a single cached block.
 *
 * This is cache breakpoint 1 of 3. Because the content is stable, the entry is
 * written once and read on every subsequent request.
 */
function buildSystemBlocks(input: SystemPromptInput): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text" as const,
      text: input,
      cache_control: CACHE_CONTROL,
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

/**
 * Callbacks for progressive delivery of a streaming Claude response.
 * All callbacks are optional; callers register only what they need.
 */
export interface StreamCallbacks {
  /** Fired on each text delta (incremental chunk). */
  onText?: (textDelta: string, textSnapshot: string) => void;
  /** Fired when a tool call begins execution. */
  onToolUseStart?: (toolName: string) => void;
  /** Fired when a tool call finishes execution. */
  onToolUseEnd?: (toolName: string) => void;
}

/** Default max tool use iterations before forcing a text response. */
const DEFAULT_MAX_ITERATIONS = 5;

/**
 * Per-call output ceiling, covering thinking and response text together.
 * See the AI block in config.ts for why this needs generous headroom.
 */
const MAX_TOKENS = AI.maxTokens;

/**
 * Reasoning-effort hint, spread into each request only when configured --
 * the parameter is rejected by models that do not support it.
 */
const EFFORT_PARAMS: { output_config?: { effort: "low" | "medium" | "high" | "max" } } =
  AI.effort ? { output_config: { effort: AI.effort } } : {};

/**
 * Params for the final call made once the tool loop is exhausted.
 *
 * `tools` MUST stay on the request: the API rejects any request whose messages
 * contain tool_use/tool_result blocks when no tools are defined, and by this
 * point the loop has appended plenty of both. `tool_choice: none` is what
 * actually forces a text-only answer.
 */
const FORCE_TEXT_PARAMS = { tool_choice: { type: "none" as const } };

/** Default max retries for 429 rate-limit errors. */
const DEFAULT_MAX_RETRIES = 3;

/** Base delay in milliseconds for exponential backoff. */
const BASE_DELAY_MS = 1_000;

/**
 * Retry a function with exponential backoff and jitter on 429 errors.
 *
 * Only retries Anthropic API 429 (rate limit) errors. All other errors
 * are re-thrown immediately. Respects the Retry-After header when present.
 *
 * @param fn - The async function to retry
 * @param options.maxRetries - Maximum number of retry attempts
 * @param options.onRetry - Optional callback invoked before each retry sleep
 * @param options.logger - Optional pino logger for structured retry logging
 * @param options.context - Optional context fields for structured logging
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    onRetry?: (attempt: number, delayMs: number) => void | Promise<void>;
    logger?: Logger;
    context?: Record<string, unknown>;
  },
): Promise<T> {
  const { maxRetries, onRetry, logger, context } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Only retry on 429 rate-limit errors
      const is429 = error instanceof APIError && error.status === 429;
      if (!is429) {
        throw error;
      }

      // Exhausted all retries
      if (attempt >= maxRetries) {
        logger?.error(
          { ...context, attempt, maxRetries, error: (error as Error).message },
          "All retry attempts exhausted for 429 rate limit",
        );
        throw error;
      }

      // Calculate delay: exponential backoff with jitter
      const exponentialDelay = BASE_DELAY_MS * Math.pow(2, attempt);
      const jitter = Math.random() * 0.5 * exponentialDelay; // 0-50% jitter
      let delayMs = exponentialDelay + jitter;

      // Respect Retry-After header if present
      const apiError = error as APIError;
      const retryAfterHeader = apiError.headers?.get?.("retry-after");
      if (retryAfterHeader) {
        const retryAfterSeconds = parseFloat(retryAfterHeader);
        if (!isNaN(retryAfterSeconds)) {
          const retryAfterMs = retryAfterSeconds * 1_000;
          delayMs = Math.max(retryAfterMs, delayMs);
        }
      }

      logger?.warn(
        {
          ...context,
          attempt: attempt + 1,
          maxRetries,
          delayMs: Math.round(delayMs),
          retryAfterHeader: retryAfterHeader ?? null,
          error: (error as Error).message,
        },
        "Retrying after 429 rate limit",
      );

      // Call onRetry callback before sleeping
      if (onRetry) {
        await onRetry(attempt + 1, Math.round(delayMs));
      }

      // Sleep
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // Should be unreachable, but TypeScript needs it
  throw new Error("retryWithBackoff: unexpected code path");
}

/**
 * Create a Claude API client with the given credentials.
 *
 * Factory pattern matches existing codebase conventions (createDatabase, createBot).
 * maxRetries: 0 -- we handle retries ourselves for user-facing messaging.
 * timeout: 60_000 -- 60 second timeout per request.
 */
export function createClaudeClient(apiKey: string, model: string, clientLogger?: Logger) {
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
     * Wraps the API call with retryWithBackoff to handle 429 rate limits.
     *
     * @param userMessages - Array of user message strings, joined with double newlines
     * @param systemPrompt - Optional system prompt override
     * @param onRetry - Optional callback invoked before each retry sleep
     * @returns ClaudeResponse with text, usage, model, and stopReason
     */
    async sendMessage(
      userMessages: string[],
      systemPrompt?: SystemPromptInput,
      onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
    ): Promise<ClaudeResponse> {
      const prompt = systemPrompt ?? buildSystemPrompt();
      const systemBlocks = buildSystemBlocks(prompt);
      const combinedUserText = userMessages.join("\n\n");

      const response = await retryWithBackoff(
        () => client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          ...EFFORT_PARAMS,
          system: systemBlocks,
          messages: [{ role: "user" as const, content: combinedUserText }],
        }),
        { maxRetries: DEFAULT_MAX_RETRIES, onRetry, logger: clientLogger },
      );

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
     * All client.messages.create() calls are wrapped with retryWithBackoff
     * to handle 429 rate limits with exponential backoff and jitter.
     *
     * Token usage is aggregated across all iterations.
     *
     * @param messages - Full message array including conversation history
     * @param tools - Anthropic tool definitions
     * @param onToolCall - Callback to handle tool calls (sync or async)
     * @param maxIterations - Maximum tool use iterations (default 5)
     * @param systemPrompt - Optional system prompt override
     * @param onRetry - Optional callback invoked before each retry sleep (for user notifications)
     * @returns ClaudeResponse with aggregated usage from all iterations
     */
    async sendMessageWithTools(
      messages: Anthropic.MessageParam[],
      tools: Anthropic.Tool[],
      onToolCall: (name: string, input: Record<string, unknown>) => string | Promise<string>,
      maxIterations: number = DEFAULT_MAX_ITERATIONS,
      systemPrompt?: SystemPromptInput,
      onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
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
      // Cache breakpoint 3 of 3: rolls forward onto each new batch of tool
      // results so iteration N reads 1..N-1 instead of reprocessing them.
      let loopCacheMark: Anthropic.ContentBlockParam | null = null;
      let finalModel = model;
      let finalStopReason = "unknown";

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response = await retryWithBackoff(
          () => client.messages.create({
            model,
            max_tokens: MAX_TOKENS,
            ...EFFORT_PARAMS,
            system: systemBlock,
            messages: loopMessages,
            tools,
          }),
          { maxRetries: DEFAULT_MAX_RETRIES, onRetry, logger: clientLogger },
        );

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
            truncated: finalStopReason === "max_tokens",
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
            truncated: finalStopReason === "max_tokens",
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
        loopCacheMark = moveLoopCacheBreakpoint(loopCacheMark, toolResults);
        loopMessages.push({
          role: "user" as const,
          content: toolResults,
        });
      }

      // Max iterations reached -- force a text response. Tools stay declared
      // (the messages carry tool_use/tool_result blocks) and tool_choice: none
      // is what stops the model reaching for another one.
      const finalResponse = await retryWithBackoff(
        () => client.messages.create({
          model,
          max_tokens: MAX_TOKENS,
          ...EFFORT_PARAMS,
          system: systemBlock,
          messages: loopMessages,
          tools,
          ...FORCE_TEXT_PARAMS,
        }),
        { maxRetries: DEFAULT_MAX_RETRIES, onRetry, logger: clientLogger },
      );

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
        truncated: finalResponse.stop_reason === "max_tokens",
      };
    },

    /**
     * Stream a message to Claude with tool support, firing callbacks for
     * progressive text delivery and tool lifecycle events.
     *
     * Uses the Anthropic SDK's `client.messages.stream()` API for incremental
     * text delivery. Implements the same multi-iteration tool use loop as
     * `sendMessageWithTools`, but each iteration streams text via callbacks.
     *
     * The `onText` callback fires on EVERY iteration (including ones that end
     * with tool_use). The caller (stream sender / bridge) decides how to handle
     * partial text before tool calls vs final text.
     *
     * Token usage is aggregated across all stream iterations.
     *
     * @param messages - Full message array including conversation history
     * @param tools - Anthropic tool definitions
     * @param onToolCall - Callback to handle tool calls (sync or async)
     * @param callbacks - Stream event callbacks (onText, onToolUseStart, onToolUseEnd)
     * @param maxIterations - Maximum tool use iterations (default 5)
     * @param systemPrompt - Optional system prompt override
     * @param onRetry - Optional callback invoked before each retry sleep
     * @returns ClaudeResponse with aggregated usage from all iterations
     */
    async streamMessageWithTools(
      messages: Anthropic.MessageParam[],
      tools: Anthropic.Tool[],
      onToolCall: (name: string, input: Record<string, unknown>) => string | Promise<string>,
      callbacks: StreamCallbacks,
      maxIterations: number = DEFAULT_MAX_ITERATIONS,
      systemPrompt?: SystemPromptInput,
      onRetry?: (attempt: number, delayMs: number) => void | Promise<void>,
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
      // Cache breakpoint 3 of 3: rolls forward onto each new batch of tool
      // results so iteration N reads 1..N-1 instead of reprocessing them.
      let loopCacheMark: Anthropic.ContentBlockParam | null = null;
      let finalModel = model;
      let finalStopReason = "unknown";

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Wrap the entire stream lifecycle in retryWithBackoff for 429 handling
        const response = await retryWithBackoff(
          async () => {
            const stream = client.messages.stream({
              model,
              max_tokens: MAX_TOKENS,
              ...EFFORT_PARAMS,
              system: systemBlock,
              messages: loopMessages,
              tools,
            });

            // Register text delta callback -- fires on every iteration
            stream.on("text", (delta, snapshot) => {
              callbacks.onText?.(delta, snapshot);
            });

            // Wait for the complete message
            return await stream.finalMessage();
          },
          { maxRetries: DEFAULT_MAX_RETRIES, onRetry, logger: clientLogger },
        );

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
            truncated: finalStopReason === "max_tokens",
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
            truncated: finalStopReason === "max_tokens",
          };
        }

        // Handle tool calls with callbacks and error resilience
        const toolResults: Anthropic.ToolResultBlockParam[] =
          await Promise.all(toolUseBlocks.map(async (block) => {
            callbacks.onToolUseStart?.(block.name);
            try {
              const result = await onToolCall(
                block.name,
                block.input as Record<string, unknown>,
              );
              callbacks.onToolUseEnd?.(block.name);
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: result,
              };
            } catch (error) {
              callbacks.onToolUseEnd?.(block.name);
              return {
                type: "tool_result" as const,
                tool_use_id: block.id,
                content: JSON.stringify({ error: sanitizeToolError(error) }),
                is_error: true,
              };
            }
          }));

        // Append assistant response + all tool results in ONE user message
        loopMessages.push({
          role: "assistant" as const,
          content: response.content,
        });
        loopCacheMark = moveLoopCacheBreakpoint(loopCacheMark, toolResults);
        loopMessages.push({
          role: "user" as const,
          content: toolResults,
        });
      }

      // Max iterations reached -- force a text response. Tools stay declared
      // (the messages carry tool_use/tool_result blocks) and tool_choice: none
      // is what stops the model reaching for another one.
      const finalResponse = await retryWithBackoff(
        async () => {
          const stream = client.messages.stream({
            model,
            max_tokens: MAX_TOKENS,
            ...EFFORT_PARAMS,
            system: systemBlock,
            messages: loopMessages,
            tools,
            ...FORCE_TEXT_PARAMS,
          });

          stream.on("text", (delta, snapshot) => {
            callbacks.onText?.(delta, snapshot);
          });

          return await stream.finalMessage();
        },
        { maxRetries: DEFAULT_MAX_RETRIES, onRetry, logger: clientLogger },
      );

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
        truncated: finalResponse.stop_reason === "max_tokens",
      };
    },
  };
}
