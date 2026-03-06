/**
 * Telegram stream sender -- manages the lifecycle of a progressively-delivered
 * message during Claude response streaming.
 *
 * Flow: sendPlaceholder() -> appendText() / showToolStatus() -> finalize()
 *
 * Edits are paced at ~300ms intervals to respect Telegram rate limits.
 * All Telegram API calls are wrapped in try/catch -- failures are logged and
 * skipped, never thrown (per streaming decisions).
 */

import type { Logger } from "pino";
import type { BotContext } from "../bot/context.js";
import { sendFormattedMessage } from "./sender.js";

/** Blinking cursor shown while streaming. */
const CURSOR = "\u258D"; // ▍

/** Minimum interval between Telegram editMessageText calls (ms). */
const EDIT_INTERVAL_MS = 300;

/** Interval for typing indicator keep-alive (ms). */
const TYPING_INTERVAL_MS = 4_000;

/** Threshold below which a reply is "short" and sent as a fresh message. */
const SHORT_REPLY_THRESHOLD = 50;

/** Telegram single-message character limit. */
const TELEGRAM_MAX_LENGTH = 4096;

export interface TelegramStreamSender {
  /** Send the initial placeholder message (just the cursor). */
  sendPlaceholder(): Promise<void>;

  /** Append a text delta from the Claude stream. */
  appendText(delta: string): void;

  /** Show a tool status label inline (e.g., "Searching recipes..."). */
  showToolStatus(label: string): void;

  /** Clear the tool status label. */
  clearToolStatus(): void;

  /**
   * Finalize the stream -- send the clean final message.
   * @param overrideText Optional text to use instead of accumulated text.
   * @param options Optional settings including reply_markup for inline keyboards.
   * @returns The final text that was displayed.
   */
  finalize(overrideText?: string, options?: { reply_markup?: unknown }): Promise<string>;

  /**
   * Handle a stream error -- append an error note to partial text.
   * @returns The accumulated text with error note.
   */
  handleError(): Promise<string>;

  /**
   * Get the message ID of the streamed message (for post-finalize edits).
   * @returns The message ID or null if placeholder was not sent.
   */
  getMessageId(): number | null;

  /**
   * Get the raw accumulated text including persisted tool status hints.
   * Used by the processor for DB saves and marker extraction.
   */
  getAccumulatedText(): string;
}

/**
 * Create a stream sender that manages the lifecycle of a streaming Telegram
 * message: placeholder -> incremental edits -> tool status -> finalize.
 */
export function createTelegramStreamSender(
  ctx: BotContext,
  senderLogger: Logger,
): TelegramStreamSender {
  const chatId = ctx.chat!.id;

  // Internal state
  let messageId: number | null = null;
  let accumulatedText = "";
  let currentToolStatus: string | null = null;
  let lastEditText = "";
  let lastEditTime = 0;
  let editTimer: ReturnType<typeof setTimeout> | null = null;
  let typingInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Perform the actual Telegram editMessageText call.
   * Uses plain text (no parse_mode) during streaming to avoid HTML errors
   * on partial Claude output. Only finalize() uses HTML parse mode.
   */
  async function doEdit(): Promise<void> {
    if (messageId === null) return;

    // Build display text with optional tool status and cursor
    let displayText = accumulatedText;
    if (currentToolStatus) {
      displayText += "\n\n" + currentToolStatus;
    }
    displayText += CURSOR;

    // Skip no-op edits
    if (displayText === lastEditText) return;

    try {
      await ctx.api.editMessageText(chatId, messageId, displayText, {
        parse_mode: undefined,
      });
      lastEditText = displayText;
      lastEditTime = Date.now();
    } catch (error) {
      // Log at debug level and skip -- user sees a text jump but no error
      senderLogger.debug(
        { error: (error as Error).message, chatId, messageId },
        "Stream edit failed, skipping",
      );
    }
  }

  /**
   * Schedule an edit with time-based pacing (debounce at EDIT_INTERVAL_MS).
   */
  function scheduleEdit(): void {
    if (editTimer !== null) return; // already scheduled

    const elapsed = Date.now() - lastEditTime;
    if (elapsed >= EDIT_INTERVAL_MS) {
      // Enough time has passed -- edit immediately
      void doEdit();
    } else {
      // Schedule edit at the EDIT_INTERVAL_MS mark
      const delay = EDIT_INTERVAL_MS - elapsed;
      editTimer = setTimeout(() => {
        editTimer = null;
        void doEdit();
      }, delay);
    }
  }

  /** Flush any pending edit timer. */
  function flushEditTimer(): void {
    if (editTimer !== null) {
      clearTimeout(editTimer);
      editTimer = null;
    }
  }

  /** Start the typing indicator keep-alive. */
  function startTypingKeepAlive(): void {
    typingInterval = setInterval(() => {
      ctx.replyWithChatAction("typing").catch(() => {
        // Silently ignore typing indicator failures
      });
    }, TYPING_INTERVAL_MS);
  }

  /** Stop the typing indicator keep-alive. */
  function stopTypingKeepAlive(): void {
    if (typingInterval !== null) {
      clearInterval(typingInterval);
      typingInterval = null;
    }
  }

  return {
    async sendPlaceholder(): Promise<void> {
      try {
        // Send initial cursor message with plain text (no HTML parsing)
        const msg = await ctx.reply(CURSOR, { parse_mode: undefined });
        messageId = msg.message_id;
        lastEditTime = Date.now();

        // Start typing indicator alongside the streaming message
        void ctx.replyWithChatAction("typing").catch(() => {});
        startTypingKeepAlive();
      } catch (error) {
        senderLogger.error(
          { error: (error as Error).message, chatId },
          "Failed to send stream placeholder",
        );
      }
    },

    appendText(delta: string): void {
      accumulatedText += delta;
      scheduleEdit();
    },

    showToolStatus(label: string): void {
      currentToolStatus = label;
      // Persist a permanent hint line in accumulated text (rendered as <i> in final HTML)
      accumulatedText += "\n\n<i>" + label + "</i>";
      // Trigger an immediate edit to show status right away
      flushEditTimer();
      void doEdit();
    },

    clearToolStatus(): void {
      currentToolStatus = null;
      // Don't trigger edit -- next text delta will update
    },

    async finalize(overrideText?: string, options?: { reply_markup?: unknown }): Promise<string> {
      flushEditTimer();
      stopTypingKeepAlive();

      const finalText = overrideText ?? accumulatedText;
      const replyMarkup = options?.reply_markup;

      // Empty response -- delete the placeholder
      if (finalText.trim().length === 0) {
        if (messageId !== null) {
          try {
            await ctx.api.deleteMessage(chatId, messageId);
          } catch {
            // Ignore delete failures
          }
        }
        return "";
      }

      // Short reply -- delete streamed message, send fresh for clean display
      // reply_markup skipped for short replies (edge case, acceptable)
      if (finalText.trim().length < SHORT_REPLY_THRESHOLD) {
        if (messageId !== null) {
          try {
            await ctx.api.deleteMessage(chatId, messageId);
          } catch {
            // Ignore delete failures
          }
        }
        try {
          await sendFormattedMessage(ctx, finalText);
        } catch (error) {
          senderLogger.error(
            { error: (error as Error).message, chatId },
            "Failed to send short reply as fresh message",
          );
        }
        return finalText;
      }

      // Long reply (over Telegram limit) -- delete and re-send with splitting
      // reply_markup skipped for split messages (can't attach to all parts)
      if (finalText.length > TELEGRAM_MAX_LENGTH) {
        if (messageId !== null) {
          try {
            await ctx.api.deleteMessage(chatId, messageId);
          } catch {
            // Ignore delete failures
          }
        }
        try {
          await sendFormattedMessage(ctx, finalText);
        } catch (error) {
          senderLogger.error(
            { error: (error as Error).message, chatId },
            "Failed to send split long reply",
          );
        }
        return finalText;
      }

      // Normal reply -- final edit with HTML parse mode for proper formatting
      if (messageId !== null) {
        const editOptions: Record<string, unknown> = { parse_mode: "HTML" };
        if (replyMarkup) editOptions.reply_markup = replyMarkup;

        try {
          await ctx.api.editMessageText(chatId, messageId, finalText, editOptions);
        } catch {
          // HTML edit failed -- fall back to plain text edit
          try {
            editOptions.parse_mode = undefined;
            await ctx.api.editMessageText(chatId, messageId, finalText, editOptions);
          } catch (error) {
            senderLogger.debug(
              { error: (error as Error).message, chatId, messageId },
              "Final edit failed, text may show with cursor",
            );
          }
        }
      }

      return finalText;
    },

    getMessageId(): number | null {
      return messageId;
    },

    getAccumulatedText(): string {
      return accumulatedText;
    },

    async handleError(): Promise<string> {
      flushEditTimer();
      stopTypingKeepAlive();

      // Append error note (plain text since we use parse_mode: undefined during streaming)
      accumulatedText += " (response interrupted -- try again)";

      // Do a final plain text edit
      if (messageId !== null) {
        try {
          await ctx.api.editMessageText(chatId, messageId, accumulatedText, {
            parse_mode: undefined,
          });
        } catch (error) {
          senderLogger.debug(
            { error: (error as Error).message, chatId, messageId },
            "Error message edit failed",
          );
        }
      }

      return accumulatedText;
    },
  };
}
