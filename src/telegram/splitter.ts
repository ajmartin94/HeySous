/**
 * Message splitting for Telegram's 4096-character HTML message limit.
 * Splits at natural boundaries: paragraph > line > sentence > word > hard cut.
 */

/** Minimum split position as a fraction of maxLength to avoid tiny first chunks. */
const MIN_SPLIT_RATIO = 0.3;

/**
 * Split a message into chunks that fit within the specified max length.
 * Prefers splitting at natural boundaries (paragraphs, lines, sentences, words).
 *
 * Priority cascade for split points:
 * 1. Paragraph boundary ("\n\n")
 * 2. Line break ("\n")
 * 3. Sentence boundary (". ")
 * 4. Word boundary (" ")
 * 5. Hard cut at maxLength
 */
export function splitMessage(
  text: string,
  maxLength: number = 4096
): string[] {
  if (text.length <= maxLength) {
    return [text];
  }

  const chunks: string[] = [];
  let remaining = text;
  const minSplitPos = Math.floor(maxLength * MIN_SPLIT_RATIO);

  while (remaining.length > maxLength) {
    let splitAt = -1;

    // 1. Try paragraph boundary ("\n\n")
    const paragraphIdx = remaining.lastIndexOf("\n\n", maxLength);
    if (paragraphIdx >= minSplitPos) {
      splitAt = paragraphIdx;
    }

    // 2. Try line break ("\n")
    if (splitAt === -1) {
      const lineIdx = remaining.lastIndexOf("\n", maxLength);
      if (lineIdx >= minSplitPos) {
        splitAt = lineIdx;
      }
    }

    // 3. Try sentence boundary (". ")
    if (splitAt === -1) {
      const sentenceIdx = remaining.lastIndexOf(". ", maxLength);
      if (sentenceIdx >= minSplitPos) {
        // Include the period in the first chunk
        splitAt = sentenceIdx + 1;
      }
    }

    // 4. Try word boundary (" ")
    if (splitAt === -1) {
      const wordIdx = remaining.lastIndexOf(" ", maxLength);
      if (wordIdx >= minSplitPos) {
        splitAt = wordIdx;
      }
    }

    // 5. Hard cut as last resort
    if (splitAt === -1) {
      splitAt = maxLength;
    }

    const chunk = remaining.substring(0, splitAt).trimEnd();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }
    remaining = remaining.substring(splitAt).trimStart();
  }

  // Push final remaining text
  if (remaining.length > 0 || chunks.length === 0) {
    chunks.push(remaining);
  }

  return chunks;
}
