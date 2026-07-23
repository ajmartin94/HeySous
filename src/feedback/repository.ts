import type BetterSqlite3 from "better-sqlite3";
import type {
  FeedbackCheckin,
  FeedbackCheckinStatus,
  FeedbackSentiment,
} from "./types.js";

/** Raw row shape for feedback_checkins from SQLite. */
interface FeedbackCheckinRow {
  id: number;
  household_id: string;
  reminder_id: number;
  meals_json: string;
  status: string;
  sentiment: string | null;
  notes: string | null;
  responded_at: number | null;
  created_at: number;
}

/** Map a raw feedback_checkins row to the FeedbackCheckin interface. */
function mapCheckin(row: FeedbackCheckinRow): FeedbackCheckin {
  return {
    id: row.id,
    householdId: row.household_id,
    reminderId: row.reminder_id,
    mealsJson: row.meals_json,
    status: row.status as FeedbackCheckinStatus,
    sentiment: row.sentiment as FeedbackSentiment | null,
    notes: row.notes,
    respondedAt:
      row.responded_at != null ? new Date(row.responded_at * 1000) : null,
    createdAt: new Date(row.created_at * 1000),
  };
}

/**
 * Factory function for feedback check-in CRUD operations.
 * Uses raw SQLite queries via sqlite.prepare() -- same pattern as
 * reminders/repository.ts and grocery/repository.ts.
 */
export function createFeedbackRepository(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * Create a new feedback check-in tracking record.
     */
    createCheckin(params: {
      householdId: string;
      reminderId: number;
      mealsJson: string;
    }): FeedbackCheckin {
      const result = sqlite
        .prepare(
          `INSERT INTO feedback_checkins (household_id, reminder_id, meals_json)
           VALUES (?, ?, ?)`,
        )
        .run(params.householdId, params.reminderId, params.mealsJson);

      const row = sqlite
        .prepare(`SELECT * FROM feedback_checkins WHERE id = ?`)
        .get(result.lastInsertRowid) as FeedbackCheckinRow;

      return mapCheckin(row);
    },

    /**
     * Mark a pending check-in as sent (delivered to the user).
     *
     * Called by the poller after the feedback sender successfully delivers the
     * check-in message. Only transitions rows still in 'pending' so it never
     * clobbers a 'responded'/'expired' terminal state or re-sends. This is the
     * transition that was previously missing entirely -- without it, check-ins
     * stayed 'pending' forever and expireOldCheckins (which only touched 'sent'
     * rows) never fired.
     */
    markCheckinSent(id: number): void {
      sqlite
        .prepare(
          `UPDATE feedback_checkins
           SET status = 'sent'
           WHERE id = ? AND status = 'pending'`,
        )
        .run(id);
    },

    /**
     * Look up a check-in by its associated reminder ID.
     * Returns null if not found.
     */
    getCheckinByReminderId(reminderId: number): FeedbackCheckin | null {
      const row = sqlite
        .prepare(`SELECT * FROM feedback_checkins WHERE reminder_id = ?`)
        .get(reminderId) as FeedbackCheckinRow | undefined;

      return row ? mapCheckin(row) : null;
    },

    /**
     * Get sent but not responded check-ins for a chat.
     * Used for free-text response matching.
     */
    getPendingSentCheckins(householdId: string): FeedbackCheckin[] {
      const rows = sqlite
        .prepare(
          `SELECT * FROM feedback_checkins
           WHERE household_id = ? AND status = 'sent'
           ORDER BY created_at DESC`,
        )
        .all(householdId) as FeedbackCheckinRow[];

      return rows.map(mapCheckin);
    },

    /**
     * Record a user's response to a check-in.
     * Marks the check-in as responded with sentiment and optional notes.
     */
    recordResponse(
      id: number,
      sentiment: FeedbackSentiment,
      notes: string | null,
    ): void {
      sqlite
        .prepare(
          `UPDATE feedback_checkins
           SET status = 'responded', sentiment = ?, notes = ?, responded_at = unixepoch()
           WHERE id = ?`,
        )
        .run(sentiment, notes, id);
    },

    /**
     * Mark stale check-ins as expired so they stop accumulating forever.
     *
     * Two classes of stale rows are swept (both 24+ hours old):
     *  1. 'sent' check-ins the user never answered -- they were delivered but no
     *     response came in, so stop treating them as "awaiting response".
     *  2. 'pending' check-ins with no still-pending reminder backing them --
     *     either the reminder was deleted (orphaned) or already fired/failed, so
     *     the check-in will never be delivered. This drains the backlog of
     *     undelivered pending rows (the ones that previously piled up because the
     *     pending->sent transition was missing) while leaving genuinely future
     *     check-ins (whose reminder is still 'pending') untouched.
     *
     * 'responded' and already-'expired' rows are terminal and never touched.
     */
    expireOldCheckins(): void {
      sqlite
        .prepare(
          `UPDATE feedback_checkins
           SET status = 'expired'
           WHERE created_at < (unixepoch() - 86400)
             AND (
               status = 'sent'
               OR (
                 status = 'pending'
                 AND NOT EXISTS (
                   SELECT 1 FROM reminders r
                   WHERE r.id = feedback_checkins.reminder_id
                     AND r.status = 'pending'
                 )
               )
             )`,
        )
        .run();
    },

    /**
     * Get recent feedback for a chat (for context injection).
     * Defaults to last 10 responded check-ins.
     */
    getRecentFeedback(householdId: string, limit: number = 10): FeedbackCheckin[] {
      const rows = sqlite
        .prepare(
          `SELECT * FROM feedback_checkins
           WHERE household_id = ? AND status = 'responded'
           ORDER BY responded_at DESC
           LIMIT ?`,
        )
        .all(householdId, limit) as FeedbackCheckinRow[];

      return rows.map(mapCheckin);
    },
  };
}
