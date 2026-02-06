/**
 * Pipeline Processor
 *
 * Orchestrates the full message processing pipeline:
 * typing indicator -> Claude call with retry -> 30s timeout messaging ->
 * formatted response delivery -> token usage logged to database and pino.
 *
 * The processor NEVER throws -- it's called from the debounce queue's
 * fire-and-forget pattern. All errors are caught and handled with
 * in-character error messages to the user.
 */

import type { PendingBatch } from "./message-queue.js";
import type { BotContext } from "../bot/context.js";
import type { ClaudeResponse } from "../ai/types.js";
import { calculateCost } from "../ai/claude-client.js";
import { sendFormattedMessage } from "../telegram/sender.js";
import { tokenUsage } from "../db/schema.js";
import type { DrizzleDatabase } from "../db/index.js";
import type { Logger } from "pino";

const TIMEOUT_WARNING_MS = 30_000;
const IN_CHARACTER_ERROR =
  "Sorry, I'm having trouble thinking right now. Try again in a moment!";

interface ClaudeClient {
  sendMessage(userMessages: string[]): Promise<ClaudeResponse>;
}

interface ProcessorDeps {
  claudeClient: ClaudeClient;
  db: DrizzleDatabase;
  logger: Logger;
}

/**
 * Create a pipeline processor that handles batched messages end-to-end.
 *
 * Returns a processBatch function suitable for use as a ProcessFn callback
 * from the MessageQueue.
 */
export function createProcessor(deps: ProcessorDeps) {
  const { claudeClient, db, logger: log } = deps;

  return async function processBatch(batch: PendingBatch): Promise<void> {
    const ctx = batch.ctx as BotContext;
    const { chatId, userId } = batch;

    try {
      // a. Start typing indicator (non-blocking)
      try {
        await ctx.replyWithChatAction("typing");
      } catch {
        // Typing indicator failure should not block processing
      }

      // b. Build user message from batch
      const userText = batch.messages.map((m) => m.text).join("\n\n");
      const userMessages = [userText];

      // c. 30-second timeout warning timer
      let timeoutFired = false;
      const timeoutTimer = setTimeout(async () => {
        timeoutFired = true;
        try {
          await ctx.reply(
            "This is taking longer than usual, hang tight...",
          );
        } catch {
          // Best-effort timeout message
        }
      }, TIMEOUT_WARNING_MS);

      // d + e. Call Claude with one silent retry
      let response: ClaudeResponse;
      const startTime = Date.now();

      try {
        response = await claudeClient.sendMessage(userMessages);
      } catch (firstError) {
        log.warn(
          {
            error: firstError instanceof Error ? firstError.message : String(firstError),
            stack: firstError instanceof Error ? firstError.stack : undefined,
            chatId,
            userId,
            timestamp: new Date().toISOString(),
          },
          "Claude API call failed (attempt 1), retrying",
        );

        try {
          response = await claudeClient.sendMessage(userMessages);
        } catch (secondError) {
          clearTimeout(timeoutTimer);
          log.error(
            {
              error: secondError instanceof Error ? secondError.message : String(secondError),
              stack: secondError instanceof Error ? secondError.stack : undefined,
              chatId,
              userId,
              timestamp: new Date().toISOString(),
            },
            "Claude API call failed (attempt 2), sending error to user",
          );
          try {
            await ctx.reply(IN_CHARACTER_ERROR);
          } catch {
            // Best-effort error message
          }
          return;
        }
      }

      const requestDurationMs = Date.now() - startTime;
      clearTimeout(timeoutTimer);

      // f. Send response via formatted sender
      await sendFormattedMessage(ctx, response.text);

      // g. Log token usage to database
      const estimatedCost = calculateCost(response.model, response.usage);

      await db.insert(tokenUsage).values({
        chatId,
        userId,
        model: response.model,
        conversationType: "chat",
        inputTokens: response.usage.inputTokens,
        outputTokens: response.usage.outputTokens,
        cacheCreationTokens: response.usage.cacheCreationInputTokens,
        cacheReadTokens: response.usage.cacheReadInputTokens,
        estimatedCost,
        requestDurationMs,
      });

      // h. Log token usage to pino
      log.info(
        {
          chatId,
          userId,
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          cacheCreationTokens: response.usage.cacheCreationInputTokens,
          cacheReadTokens: response.usage.cacheReadInputTokens,
          estimatedCost,
          requestDurationMs,
          conversationType: "chat",
        },
        "Claude API call completed",
      );
    } catch (outerError) {
      // i. Outer try/catch -- processor must NEVER throw
      log.error(
        {
          error: outerError instanceof Error ? outerError.message : String(outerError),
          stack: outerError instanceof Error ? outerError.stack : undefined,
          chatId,
          userId,
        },
        "Unexpected error in pipeline processor",
      );
      try {
        await ctx.reply(IN_CHARACTER_ERROR);
      } catch {
        // Best-effort error message
      }
    }
  };
}
