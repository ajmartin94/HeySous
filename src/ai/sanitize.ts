import type { Logger } from "pino";

/**
 * Strip HTML tags and control characters from user-controlled text before
 * interpolation into the Claude system prompt.
 *
 * Sanitization is applied at read time (system prompt construction), not write
 * time -- the database stores the original input unmodified.
 *
 * @param text - Raw user-controlled text (display name, preference title/summary)
 * @returns Cleaned string safe for prompt interpolation
 */
export function sanitizeForPrompt(text: string): string {
  if (!text) return "";

  let result = text;

  // Strip all HTML tags (opening, closing, self-closing, with attributes)
  result = result.replace(/<[^>]*>/g, "");

  // Strip null bytes
  result = result.replace(/\0/g, "");

  // Strip ANSI escape sequences (e.g. \x1B[31m, \x1B[0m)
  // eslint-disable-next-line no-control-regex
  result = result.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "");

  return result.trim();
}

/**
 * Sanitize user-controlled text and log when sanitization modifies the input.
 *
 * Wraps sanitizeForPrompt with structured Pino logging so that sanitization
 * events are visible to admins. Uses the "prompt_sanitization" event tag.
 *
 * @param text - Raw user-controlled text
 * @param field - Field identifier for logging (e.g. "userName", "preference.title")
 * @param logger - Pino logger instance
 * @returns Sanitized string
 */
export function sanitizeAndLog(
  text: string,
  field: string,
  logger: Logger,
): string {
  const result = sanitizeForPrompt(text);

  if (result !== text) {
    logger.info(
      {
        field,
        originalLength: text.length,
        sanitizedLength: result.length,
        event: "prompt_sanitization",
      },
      "Sanitized user input for prompt",
    );
  }

  return result;
}
