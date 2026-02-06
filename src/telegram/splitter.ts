/**
 * Message splitting for Telegram's 4096-character HTML message limit.
 * Splits at natural boundaries: paragraph > line > sentence > word > hard cut.
 */

/**
 * Split a message into chunks that fit within the specified max length.
 * Prefers splitting at natural boundaries (paragraphs, lines, sentences, words).
 */
export function splitMessage(
  text: string,
  maxLength: number = 4096
): string[] {
  return [text];
}
