/**
 * Message Handler
 *
 * Enqueues incoming text messages to the debounce queue for async processing.
 * The handler returns IMMEDIATELY -- Claude processing happens asynchronously
 * after the debounce window expires. This prevents Telegram webhook timeouts.
 */

import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import type { MessageQueue, ProcessFn } from "../../pipeline/message-queue.js";

/**
 * Create a message handler wired to the async pipeline.
 *
 * Factory pattern consistent with createBot, createProcessor, etc.
 * The message:text handler calls queue.enqueue() (synchronous) and returns
 * immediately -- no awaiting of slow operations.
 */
export function createMessageHandler(
  queue: MessageQueue,
  processBatch: ProcessFn,
): Composer<BotContext> {
  const messageHandler = new Composer<BotContext>();

  messageHandler.on("message:text", (ctx) => {
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from?.id ?? "unknown");
    const text = ctx.message.text;

    // Enqueue and return immediately -- do NOT await Claude here.
    // The queue's debounce timer fires processBatch asynchronously.
    queue.enqueue(chatId, userId, text, ctx, processBatch);
  });

  return messageHandler;
}
