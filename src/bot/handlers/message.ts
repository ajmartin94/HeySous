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

/** MIME types we accept as images when sent as documents */
const IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

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

  /** Shared helper: download image by file_id, base64-encode, and enqueue */
  async function downloadAndEnqueue(
    ctx: BotContext,
    fileId: string,
    mimeType: string,
    caption: string,
  ): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const userId = String(ctx.from?.id ?? "unknown");

    try {
      const file = await ctx.api.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${ctx.api.token}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.status}`);
      }

      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > MAX_IMAGE_SIZE) {
        await ctx.reply("That photo's a bit large for me to process. Try cropping or sending a smaller version!");
        return;
      }

      const imageBase64 = buffer.toString("base64");
      queue.enqueue(chatId, userId, caption, ctx, processBatch, imageBase64, mimeType);
    } catch (error) {
      logger.error(
        { error: error instanceof Error ? error.message : String(error), chatId },
        "Failed to download image for processing",
      );
      await ctx.reply("I had trouble downloading that photo. Could you try sending it again?");
    }
  }

  messageHandler.on("message:photo", async (ctx) => {
    const caption = ctx.message.caption ?? "";
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    await downloadAndEnqueue(ctx, largest.file_id, "image/jpeg", caption);
  });

  // Handle images sent as documents (desktop drag-and-drop, "send as file", etc.)
  messageHandler.on("message:document", async (ctx) => {
    const doc = ctx.message.document;
    if (!doc.mime_type || !IMAGE_MIME_TYPES.has(doc.mime_type)) {
      // Not an image document -- ignore (falls through to no handler)
      return;
    }
    const caption = ctx.message.caption ?? "";
    await downloadAndEnqueue(ctx, doc.file_id, doc.mime_type, caption);
  });

  return messageHandler;
}
