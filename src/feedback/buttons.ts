import { InlineKeyboard } from "grammy";

/** Prefix for all feedback-related callback data. */
export const FEEDBACK_CB_PREFIX = "f:";

/**
 * Encode a feedback response into compact callback data.
 * Format: "f:{sentiment}:{reminderId}" -- well under the 64-byte Telegram limit.
 *
 * Example: encodeFeedback("pos", 42) returns "f:pos:42"
 */
export function encodeFeedback(sentiment: string, reminderId: number): string {
  return `${FEEDBACK_CB_PREFIX}${sentiment}:${reminderId}`;
}

/**
 * Parse a feedback callback data string into its sentiment and reminder ID.
 * Returns null if the data is not a feedback callback or parsing fails.
 *
 * Example: parseFeedbackCallback("f:pos:42") returns { sentiment: "pos", reminderId: 42 }
 */
export function parseFeedbackCallback(
  data: string,
): { sentiment: string; reminderId: number } | null {
  if (!data.startsWith(FEEDBACK_CB_PREFIX)) return null;

  const remainder = data.slice(FEEDBACK_CB_PREFIX.length);
  const parts = remainder.split(":");
  if (parts.length !== 2) return null;

  const reminderId = parseInt(parts[1], 10);
  if (isNaN(reminderId)) return null;

  return { sentiment: parts[0], reminderId };
}

/**
 * Build an InlineKeyboard with 4 sentiment buttons for a feedback check-in.
 *
 * Layout (2 rows, 2 buttons each):
 *   Row 1: "Loved it" | "It was okay"
 *   Row 2: "Didn't work" | "Skipped"
 */
export function buildFeedbackKeyboard(reminderId: number): InlineKeyboard {
  return new InlineKeyboard()
    .text("\u{1F44D} Loved it", encodeFeedback("pos", reminderId))
    .text("\u{1F610} It was okay", encodeFeedback("ok", reminderId))
    .row()
    .text("\u{1F44E} Didn't work", encodeFeedback("neg", reminderId))
    .text("\u{23E9} Skipped", encodeFeedback("skip", reminderId));
}
