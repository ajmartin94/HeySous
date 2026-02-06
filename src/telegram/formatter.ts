/**
 * HTML escaping and formatting utilities for Telegram messages.
 * Telegram supports a subset of HTML tags in its Bot API.
 */

/** Tags supported by Telegram's HTML parse mode. */
const ALLOWED_TAGS = new Set([
  "b",
  "strong",
  "i",
  "em",
  "u",
  "ins",
  "s",
  "strike",
  "del",
  "a",
  "code",
  "pre",
]);

/**
 * Escape HTML special characters to prevent injection in Telegram HTML messages.
 * Order matters: ampersand MUST be replaced first to avoid double-encoding.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format a bot response by stripping unsupported HTML tags while preserving
 * Telegram-supported tags (b, strong, i, em, u, ins, s, strike, del, a, code, pre).
 * Also replaces <br> variants with newlines.
 */
export function formatBotResponse(text: string): string {
  if (text === "") return "";

  // Replace <br>, <br/>, <br /> with newline
  let result = text.replace(/<br\s*\/?>/gi, "\n");

  // Remove unsupported HTML tags while preserving their content.
  // Match opening tags, closing tags, and self-closing tags.
  // For each match, check if the tag name is in the allowed set.
  // If not allowed, remove the tag (but keep any inner content).
  result = result.replace(
    /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*\/?>/g,
    (match, tagName: string) => {
      if (ALLOWED_TAGS.has(tagName.toLowerCase())) {
        return match;
      }
      return "";
    }
  );

  return result;
}
