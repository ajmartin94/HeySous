/**
 * Tests for TelegramStreamSender -- multi-turn text accumulation,
 * tool status persistence, and finalize behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTelegramStreamSender } from "../../src/telegram/stream-sender.js";
import type { BotContext } from "../../src/bot/context.js";
import type { Logger } from "pino";

// Mock BotContext with the Telegram API methods used by stream-sender
function createMockCtx(): BotContext {
  return {
    chat: { id: 123 },
    reply: vi.fn().mockResolvedValue({ message_id: 42 }),
    replyWithChatAction: vi.fn().mockResolvedValue(undefined),
    api: {
      editMessageText: vi.fn().mockResolvedValue(undefined),
      deleteMessage: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as BotContext;
}

function createMockLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as Logger;
}

describe("TelegramStreamSender", () => {
  let ctx: BotContext;
  let logger: Logger;

  beforeEach(() => {
    vi.useFakeTimers();
    ctx = createMockCtx();
    logger = createMockLogger();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("getAccumulatedText", () => {
    it("returns empty string when no text has been appended", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      expect(sender.getAccumulatedText()).toBe("");
    });

    it("returns accumulated text from multiple appendText calls", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Hello ");
      sender.appendText("world!");

      expect(sender.getAccumulatedText()).toBe("Hello world!");
    });
  });

  describe("showToolStatus - persistent hints", () => {
    it("appends italic HTML hint to accumulated text", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Let me look that up.");
      sender.showToolStatus("Searching recipes...");

      expect(sender.getAccumulatedText()).toBe(
        "Let me look that up.\n\n<i>Searching recipes...</i>",
      );
    });

    it("appends multiple tool status hints on successive calls", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.showToolStatus("Searching recipes...");
      sender.clearToolStatus();
      sender.showToolStatus("Saving to your recipe book...");

      const text = sender.getAccumulatedText();
      expect(text).toContain("<i>Searching recipes...</i>");
      expect(text).toContain("<i>Saving to your recipe book...</i>");
    });
  });

  describe("clearToolStatus", () => {
    it("does NOT remove persisted hint from accumulated text", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("OK ");
      sender.showToolStatus("Searching recipes...");
      sender.clearToolStatus();

      // Hint is still in accumulated text
      expect(sender.getAccumulatedText()).toContain("<i>Searching recipes...</i>");
    });
  });

  describe("multi-turn accumulation", () => {
    it("preserves text across tool call turns with separator", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      // Turn 1: text before tool call
      sender.appendText("OK I'll look that up. ");
      sender.showToolStatus("Searching recipes...");
      sender.clearToolStatus();

      // Turn 2: text after tool call
      sender.appendText("Here are your recipes!");

      const accumulated = sender.getAccumulatedText();
      expect(accumulated).toBe(
        "OK I'll look that up. \n\n<i>Searching recipes...</i>\n\nHere are your recipes!",
      );
    });

    it("handles empty text before tool call", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      // No text before tool call
      sender.showToolStatus("Checking your meal plan...");
      sender.clearToolStatus();
      sender.appendText("Here's your plan!");

      const accumulated = sender.getAccumulatedText();
      expect(accumulated).toBe("\n\n<i>Checking your meal plan...</i>\n\nHere's your plan!");
    });
  });

  describe("streaming edits use HTML without fallback", () => {
    it("edits with HTML parse mode during streaming", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Hello <b>world</b>");
      // Flush the edit timer
      await vi.advanceTimersByTimeAsync(350);

      expect((ctx.api.editMessageText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        123, 42,
        expect.stringContaining("Hello <b>world</b>"),
        expect.objectContaining({ parse_mode: "HTML" }),
      );
    });

    it("skips edit when HTML parse fails (no plain-text fallback)", async () => {
      const editFn = ctx.api.editMessageText as ReturnType<typeof vi.fn>;
      editFn.mockRejectedValueOnce(new Error("Bad Request: can't parse entities"));

      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Unclosed <b>tag");
      await vi.advanceTimersByTimeAsync(350);

      // Only one call -- no plain-text fallback that would double API calls
      expect(editFn).toHaveBeenCalledTimes(1);
      expect(editFn).toHaveBeenCalledWith(123, 42, expect.any(String), { parse_mode: "HTML" });
    });
  });

  describe("race condition prevention", () => {
    it("awaits in-flight edit before finalize sends final message", async () => {
      const editFn = ctx.api.editMessageText as ReturnType<typeof vi.fn>;
      const editOrder: string[] = [];

      // Make the streaming edit slow (simulates network latency)
      editFn.mockImplementation(async (_chatId: number, _msgId: number, text: string) => {
        if (text.includes("\u258D")) {
          // Streaming edit with cursor -- add delay
          await new Promise((resolve) => setTimeout(resolve, 100));
          editOrder.push("streaming");
        } else {
          editOrder.push("finalize");
        }
      });

      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      // Append enough text to pass short reply threshold
      sender.appendText("This is a long enough response to pass the short reply threshold for testing.");
      // Advance past EDIT_INTERVAL_MS to trigger immediate doEdit()
      await vi.advanceTimersByTimeAsync(350);

      // Finalize while the streaming edit is still in-flight
      const finalizePromise = sender.finalize();
      await vi.advanceTimersByTimeAsync(200);
      await finalizePromise;

      // The finalize edit must come AFTER the streaming edit completes
      expect(editOrder[editOrder.length - 1]).toBe("finalize");
    });
  });

  describe("finalize", () => {
    it("uses accumulated text when no override is provided", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("This is the accumulated message with enough chars to pass the short threshold easily.");

      const result = await sender.finalize();

      expect(result).toBe("This is the accumulated message with enough chars to pass the short threshold easily.");
      // Verify edit was called with the accumulated text
      expect((ctx.api.editMessageText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        123, 42,
        "This is the accumulated message with enough chars to pass the short threshold easily.",
        expect.objectContaining({ parse_mode: "HTML" }),
      );
    });

    it("uses override text when provided", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("This accumulated text should be ignored when override is provided.");

      const overrideText = "This override text should be used instead of accumulated text for display.";
      const result = await sender.finalize(overrideText);

      expect(result).toBe(overrideText);
    });

    it("deletes placeholder when text is empty", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      const result = await sender.finalize();

      expect(result).toBe("");
      expect((ctx.api.deleteMessage as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(123, 42);
    });

    it("includes tool status hints in final message when no override", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Let me search for that. ");
      sender.showToolStatus("Searching recipes...");
      sender.clearToolStatus();
      sender.appendText("Found 3 recipes that match! Here they are with all the details you need for cooking.");

      const result = await sender.finalize();

      expect(result).toContain("<i>Searching recipes...</i>");
      expect(result).toContain("Found 3 recipes");
    });

    it("passes reply_markup to the final edit", async () => {
      const sender = createTelegramStreamSender(ctx, logger);
      await sender.sendPlaceholder();

      sender.appendText("Here is a long enough message to not be considered short by the threshold check.");

      const markup = { inline_keyboard: [[{ text: "Open", url: "https://example.com" }]] };
      await sender.finalize(undefined, { reply_markup: markup });

      expect((ctx.api.editMessageText as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
        123, 42,
        expect.any(String),
        expect.objectContaining({ reply_markup: markup }),
      );
    });
  });
});
