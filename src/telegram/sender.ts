/**
 * Reliable message delivery with message splitting and HTML fallback.
 * Splits long messages, adds delay between chunks, and falls back to
 * plain text if HTML parsing fails.
 */

import { GrammyError } from "grammy";
import type { BotContext } from "../bot/context.js";
import { splitMessage } from "./splitter.js";
import { logger } from "../logger.js";

/** Delay between sending message chunks (milliseconds) to avoid rate limits. */
export const CHUNK_DELAY_MS = 300;

/**
 * Wait for the specified number of milliseconds.
 * Exported for testability.
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a formatted HTML message to the current chat, with automatic splitting
 * for long messages and fallback to plain text on HTML parsing errors.
 *
 * - Messages exceeding 4096 characters are split at natural boundaries
 * - A small delay is added between chunks to avoid Telegram rate limits
 * - If Telegram rejects HTML formatting, the chunk is resent as plain text
 */
export async function sendFormattedMessage(
  ctx: BotContext,
  text: string
): Promise<void> {
  const chunks = splitMessage(text);

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) {
      await delay(CHUNK_DELAY_MS);
    }

    const chunk = chunks[i];

    try {
      // Uses HTML parse mode set globally by the parse-mode plugin
      await ctx.reply(chunk);
    } catch (error) {
      if (
        error instanceof GrammyError &&
        error.description.includes("can't parse entities")
      ) {
        logger.warn(
          { chunk: chunk.substring(0, 100) },
          "HTML formatting failed, falling back to plain text"
        );
        // Override the global HTML parse mode for this single call
        await ctx.api.sendMessage(ctx.chat!.id, chunk, {
          parse_mode: undefined,
        });
      } else {
        throw error;
      }
    }
  }
}
