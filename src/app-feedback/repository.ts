import type BetterSqlite3 from "better-sqlite3";
import type { SaveFeedbackParams } from "./types.js";

/**
 * Factory function for app feedback CRUD operations.
 * Uses raw SQLite queries via sqlite.prepare() -- same pattern as
 * feedback/repository.ts and grocery/repository.ts.
 */
export function createAppFeedbackRepository(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * Save a piece of app feedback from any source channel.
     */
    saveFeedback(params: SaveFeedbackParams): void {
      sqlite
        .prepare(
          `INSERT INTO app_feedback (household_id, user_id, text, source)
           VALUES (?, ?, ?, ?)`,
        )
        .run(params.householdId, params.userId, params.text, params.source);
    },

    /**
     * Get the number of inbound messages since the last proactive prompt
     * was shown for a household.
     *
     * Queries app_feedback_prompt_tracking for the message count at last prompt,
     * then counts current total inbound messages, and returns the difference.
     */
    getMessageCountSinceLastPrompt(householdId: string): number {
      const tracking = sqlite
        .prepare(
          `SELECT messages_at_last_prompt FROM app_feedback_prompt_tracking
           WHERE household_id = ?`,
        )
        .get(householdId) as { messages_at_last_prompt: number } | undefined;

      const messagesAtLastPrompt = tracking?.messages_at_last_prompt ?? 0;

      const result = sqlite
        .prepare(
          `SELECT COUNT(*) as count FROM messages
           WHERE chat_id = ? AND direction = 'in'`,
        )
        .get(householdId) as { count: number };

      return result.count - messagesAtLastPrompt;
    },

    /**
     * Record that a proactive feedback prompt was shown for a household.
     * Snapshots the current total inbound message count so the next check
     * measures from this point forward.
     */
    recordProactivePromptShown(householdId: string): void {
      const result = sqlite
        .prepare(
          `SELECT COUNT(*) as count FROM messages
           WHERE chat_id = ? AND direction = 'in'`,
        )
        .get(householdId) as { count: number };

      sqlite
        .prepare(
          `INSERT OR REPLACE INTO app_feedback_prompt_tracking
           (household_id, last_prompt_at, messages_at_last_prompt)
           VALUES (?, unixepoch(), ?)`,
        )
        .run(householdId, result.count);
    },
  };
}
