/**
 * HTML escaping and formatting utilities for Telegram messages.
 * Telegram supports a subset of HTML tags in its Bot API.
 */

/**
 * Escape HTML special characters to prevent injection in Telegram HTML messages.
 */
export function escapeHtml(text: string): string {
  return "";
}

/**
 * Format a bot response by stripping unsupported HTML tags while preserving
 * Telegram-supported tags (b, strong, i, em, u, ins, s, strike, del, a, code, pre).
 */
export function formatBotResponse(text: string): string {
  return "";
}
