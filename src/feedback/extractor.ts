/**
 * Feedback Extractor
 *
 * Uses Claude to extract structured feedback (sentiment + notes) from
 * free-text user responses to check-in messages.
 *
 * Uses a focused system prompt (NOT the full Sous persona) for efficiency.
 */

import type { FeedbackSentiment } from "./types.js";

/**
 * Minimal Claude client interface -- same pattern as reminders/sender.ts.
 * Keeps the extractor decoupled from the full AI module.
 */
interface ClaudeClient {
  sendMessage: (
    messages: string[],
    systemPrompt?: string,
  ) => Promise<{
    text: string;
    usage: {
      inputTokens: number;
      outputTokens: number;
      cacheCreationInputTokens: number;
      cacheReadInputTokens: number;
    };
  }>;
}

/** Focused system prompt for feedback extraction. */
const EXTRACTION_SYSTEM_PROMPT = `You extract structured feedback from a user's free-text response about a meal.
Return a JSON object with two fields:
- sentiment: one of "positive", "neutral", "negative", "skipped"
- notes: a brief summary of actionable feedback (what worked, what to change). If the user just said something simple like "great" or "loved it", notes can be empty string.

Respond ONLY with the JSON object, no other text.`;

/** Extracted feedback result. */
export interface ExtractedFeedback {
  sentiment: FeedbackSentiment;
  notes: string;
}

/**
 * Extract structured feedback from free-text user input using Claude.
 *
 * Falls back to { sentiment: "neutral", notes: text } if parsing fails.
 *
 * @param text - The user's free-text feedback message
 * @param claudeClient - Minimal Claude client for API calls
 * @returns Extracted sentiment and notes
 */
export async function extractFeedback(
  text: string,
  claudeClient: ClaudeClient,
): Promise<ExtractedFeedback> {
  try {
    const response = await claudeClient.sendMessage(
      [text],
      EXTRACTION_SYSTEM_PROMPT,
    );

    const parsed = JSON.parse(response.text) as {
      sentiment?: string;
      notes?: string;
    };

    // Validate sentiment is one of the expected values
    const validSentiments: FeedbackSentiment[] = [
      "positive",
      "neutral",
      "negative",
      "skipped",
    ];
    const sentiment = validSentiments.includes(parsed.sentiment as FeedbackSentiment)
      ? (parsed.sentiment as FeedbackSentiment)
      : "neutral";

    return {
      sentiment,
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };
  } catch {
    // Fallback: treat as neutral with the raw text as notes
    return {
      sentiment: "neutral",
      notes: text,
    };
  }
}
