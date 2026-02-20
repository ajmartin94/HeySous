/**
 * Message Handler
 *
 * Enqueues incoming text messages and photos to the debounce queue for async
 * processing. The handler returns IMMEDIATELY -- Claude processing happens
 * asynchronously after the debounce window expires. This prevents Telegram
 * webhook timeouts.
 *
 * Photos are downloaded via Telegram API, base64-encoded, and enqueued
 * alongside any caption text. The processor builds multimodal Claude messages
 * with image content blocks.
 */

import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import type { MessageQueue, ProcessFn } from "../../pipeline/message-queue.js";
import { logger } from "../../logger.js";

/** Maximum image size for Claude vision API (5MB) */
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/**
 * Create a message handler wired to the async pipeline.
 *
 * Factory pattern consistent with createBot, createProcessor, etc.
 * The message:text handler calls queue.enqueue() (synchronous) and returns
 * immediately -- no awaiting of slow operations.
 * The message:photo handler downloads the image, base64-encodes it, and
 * enqueues it with the caption text.
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

  messageHandler.on("message:photo", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const userId = String(ctx.from?.id ?? "unknown");
    const caption = ctx.message.caption ?? "";

    // Get largest photo size (last in array -- Telegram sends multiple sizes)
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];

    try {
      // Download photo via Telegram API
      const file = await ctx.api.getFile(largest.file_id);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download photo: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      // Check size (5MB limit for Claude vision API)
      if (buffer.length > MAX_IMAGE_SIZE) {
        await ctx.reply("That photo's a bit large for me to process. Try cropping or sending a smaller version!");
        return;
      }

      const imageBase64 = buffer.toString("base64");

      queue.enqueue(chatId, userId, caption, ctx, processBatch, imageBase64, "image/jpeg");
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), chatId },
        "Failed to download photo for processing",
      );
      await ctx.reply("I had trouble downloading that photo. Could you try sending it again?");
    }
  });

  return messageHandler;
}
