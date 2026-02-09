import type BetterSqlite3 from "better-sqlite3";
import type { Clock } from "../clock.js";
import type {
  Reminder,
  ReminderSettings,
  ReminderStatus,
  ReminderType,
} from "./types.js";

/** Raw row shape for reminder_settings from SQLite. */
interface ReminderSettingsRow {
  id: number;
  chat_id: string;
  timezone: string;
  morning_time: string;
  dinner_time: string;
  morning_enabled: number;
  prep_alerts_enabled: number;
  muted_until: number | null;
  created_at: number;
  updated_at: number;
}

/** Raw row shape for reminders from SQLite. */
interface ReminderRow {
  id: number;
  chat_id: string;
  type: string;
  due_at: number;
  status: string;
  context_json: string;
  generated_text: string | null;
  sent_at: number | null;
  created_at: number;
}

/** Map a raw reminder_settings row to the ReminderSettings interface. */
function mapSettings(row: ReminderSettingsRow): ReminderSettings {
  return {
    id: row.id,
    chatId: row.chat_id,
    timezone: row.timezone,
    morningTime: row.morning_time,
    dinnerTime: row.dinner_time,
    morningEnabled: row.morning_enabled === 1,
    prepAlertsEnabled: row.prep_alerts_enabled === 1,
    mutedUntil: row.muted_until != null ? new Date(row.muted_until * 1000) : null,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

/** Map a raw reminders row to the Reminder interface. */
function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    chatId: row.chat_id,
    type: row.type as ReminderType,
    dueAt: new Date(row.due_at * 1000),
    status: row.status as ReminderStatus,
    contextJson: row.context_json,
    generatedText: row.generated_text,
    sentAt: row.sent_at != null ? new Date(row.sent_at * 1000) : null,
    createdAt: new Date(row.created_at * 1000),
  };
}

/**
 * Factory function for reminder CRUD operations.
 * Uses raw SQLite queries via sqlite.prepare() -- same pattern as
 * grocery/repository.ts and planning/history.ts.
 */
export function createReminderRepository(sqlite: BetterSqlite3.Database, clock?: Clock) {
  /** Current unix timestamp in seconds, using clock if available. */
  const nowUnix = () => clock ? Math.floor(clock.now() / 1000) : Math.floor(Date.now() / 1000);
  return {
    // ── Settings methods ──────────────────────────────────────────────

    /**
     * Get reminder settings for a chat.
     * Returns null if no settings exist yet.
     */
    getSettings(chatId: string): ReminderSettings | null {
      const row = sqlite
        .prepare(`SELECT * FROM reminder_settings WHERE chat_id = ?`)
        .get(chatId) as ReminderSettingsRow | undefined;

      return row ? mapSettings(row) : null;
    },

    /**
     * Insert or update settings for a chat.
     * Uses INSERT ... ON CONFLICT(chat_id) DO UPDATE with excluded pseudo-table.
     * On insert: uses provided values or defaults.
     * On conflict: updates only fields that were explicitly provided.
     */
    upsertSettings(
      chatId: string,
      updates: Partial<{
        timezone: string;
        morningTime: string;
        dinnerTime: string;
        morningEnabled: boolean;
        prepAlertsEnabled: boolean;
        mutedUntil: Date | null;
      }>,
    ): ReminderSettings {
      // For insert: use provided values or defaults
      const timezone = updates.timezone ?? "America/New_York";
      const morningTime = updates.morningTime ?? "08:00";
      const dinnerTime = updates.dinnerTime ?? "17:30";
      const morningEnabled =
        updates.morningEnabled !== undefined ? (updates.morningEnabled ? 1 : 0) : 1;
      const prepAlertsEnabled =
        updates.prepAlertsEnabled !== undefined
          ? (updates.prepAlertsEnabled ? 1 : 0)
          : 1;
      const mutedUntil =
        updates.mutedUntil !== undefined
          ? (updates.mutedUntil
              ? Math.floor(updates.mutedUntil.getTime() / 1000)
              : null)
          : null;

      // For update: use COALESCE with null sentinel to preserve existing values
      // When a field is not in updates, pass null so COALESCE picks the existing value
      const updateTimezone = updates.timezone ?? null;
      const updateMorningTime = updates.morningTime ?? null;
      const updateDinnerTime = updates.dinnerTime ?? null;
      const updateMorningEnabled =
        updates.morningEnabled !== undefined ? (updates.morningEnabled ? 1 : 0) : null;
      const updatePrepAlertsEnabled =
        updates.prepAlertsEnabled !== undefined
          ? (updates.prepAlertsEnabled ? 1 : 0)
          : null;
      // mutedUntil needs special handling: null is a valid value (unmute)
      const hasMutedUntilUpdate = updates.mutedUntil !== undefined;

      sqlite
        .prepare(
          `INSERT INTO reminder_settings (chat_id, timezone, morning_time, dinner_time, morning_enabled, prep_alerts_enabled, muted_until)
           VALUES (@chatId, @timezone, @morningTime, @dinnerTime, @morningEnabled, @prepAlertsEnabled, @mutedUntil)
           ON CONFLICT(chat_id) DO UPDATE SET
             timezone = COALESCE(@updateTimezone, timezone),
             morning_time = COALESCE(@updateMorningTime, morning_time),
             dinner_time = COALESCE(@updateDinnerTime, dinner_time),
             morning_enabled = COALESCE(@updateMorningEnabled, morning_enabled),
             prep_alerts_enabled = COALESCE(@updatePrepAlertsEnabled, prep_alerts_enabled),
             muted_until = CASE WHEN @hasMutedUntilUpdate = 1 THEN @mutedUntil ELSE muted_until END,
             updated_at = unixepoch()`,
        )
        .run({
          chatId,
          timezone,
          morningTime,
          dinnerTime,
          morningEnabled,
          prepAlertsEnabled,
          mutedUntil,
          updateTimezone,
          updateMorningTime,
          updateDinnerTime,
          updateMorningEnabled,
          updatePrepAlertsEnabled,
          hasMutedUntilUpdate: hasMutedUntilUpdate ? 1 : 0,
        });

      const row = sqlite
        .prepare(`SELECT * FROM reminder_settings WHERE chat_id = ?`)
        .get(chatId) as ReminderSettingsRow;

      return mapSettings(row);
    },

    /**
     * Get existing settings or create with defaults.
     */
    getOrCreateSettings(chatId: string): ReminderSettings {
      const existing = sqlite
        .prepare(`SELECT * FROM reminder_settings WHERE chat_id = ?`)
        .get(chatId) as ReminderSettingsRow | undefined;

      if (existing) {
        return mapSettings(existing);
      }

      return this.upsertSettings(chatId, {});
    },

    /**
     * Get all settings where at least one reminder type is enabled and not muted.
     * Used by the poller to know which chats need reminders.
     */
    getAllActiveSettings(): ReminderSettings[] {
      const rows = sqlite
        .prepare(
          `SELECT * FROM reminder_settings
           WHERE (morning_enabled = 1 OR prep_alerts_enabled = 1)
             AND (muted_until IS NULL OR muted_until < ?)`,
        )
        .all(nowUnix()) as ReminderSettingsRow[];

      return rows.map(mapSettings);
    },

    // ── Reminder methods ──────────────────────────────────────────────

    /**
     * Create a new pending reminder.
     */
    createReminder(params: {
      chatId: string;
      type: ReminderType;
      dueAt: Date;
      contextJson: string;
    }): Reminder {
      const result = sqlite
        .prepare(
          `INSERT INTO reminders (chat_id, type, due_at, context_json)
           VALUES (?, ?, ?, ?)`,
        )
        .run(
          params.chatId,
          params.type,
          Math.floor(params.dueAt.getTime() / 1000),
          params.contextJson,
        );

      const row = sqlite
        .prepare(`SELECT * FROM reminders WHERE id = ?`)
        .get(result.lastInsertRowid) as ReminderRow;

      return mapReminder(row);
    },

    /**
     * Get all pending reminders that are due (due_at <= now).
     * Ordered by due_at ASC. This is the core poller query.
     */
    getDueReminders(): Reminder[] {
      const rows = sqlite
        .prepare(
          `SELECT * FROM reminders
           WHERE status = 'pending' AND due_at <= ?
           ORDER BY due_at ASC`,
        )
        .all(nowUnix()) as ReminderRow[];

      return rows.map(mapReminder);
    },

    /**
     * Mark a reminder as sent with the generated text.
     */
    markSent(id: number, generatedText: string): void {
      sqlite
        .prepare(
          `UPDATE reminders
           SET status = 'sent', sent_at = ?, generated_text = ?
           WHERE id = ?`,
        )
        .run(nowUnix(), generatedText, id);
    },

    /**
     * Mark a reminder as failed.
     */
    markFailed(id: number): void {
      sqlite
        .prepare(`UPDATE reminders SET status = 'failed' WHERE id = ?`)
        .run(id);
    },

    /**
     * Delete all pending reminders for a chat where due_at > now.
     * Used when regenerating reminders after plan changes.
     */
    deleteFutureReminders(chatId: string): void {
      sqlite
        .prepare(
          `DELETE FROM reminders
           WHERE chat_id = ? AND status = 'pending' AND due_at > ?`,
        )
        .run(chatId, nowUnix());
    },

    /**
     * Delete all pending reminders for a chat.
     * Used on full regeneration.
     */
    deleteAllPending(chatId: string): void {
      sqlite
        .prepare(
          `DELETE FROM reminders
           WHERE chat_id = ? AND status = 'pending'`,
        )
        .run(chatId);
    },

    /**
     * Check if a pending reminder of this type already exists in the time window.
     * Prevents duplicates during regeneration.
     */
    hasPendingReminder(
      chatId: string,
      type: ReminderType,
      dueAtStart: Date,
      dueAtEnd: Date,
    ): boolean {
      const row = sqlite
        .prepare(
          `SELECT 1 FROM reminders
           WHERE chat_id = ? AND type = ? AND status = 'pending'
             AND due_at >= ? AND due_at <= ?
           LIMIT 1`,
        )
        .get(
          chatId,
          type,
          Math.floor(dueAtStart.getTime() / 1000),
          Math.floor(dueAtEnd.getTime() / 1000),
        );

      return row !== undefined;
    },
  };
}
