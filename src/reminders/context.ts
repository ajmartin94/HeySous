import type BetterSqlite3 from "better-sqlite3";

/** Raw row shape from the reminder settings query. */
interface SettingsContextRow {
  timezone: string;
  morning_time: string;
  dinner_time: string;
  morning_enabled: number;
  prep_alerts_enabled: number;
  muted_until: number | null;
}

/**
 * Build a lightweight reminder context summary for the system prompt.
 *
 * Returns a short XML block with the user's reminder settings to keep
 * system prompt tokens low. Claude uses the reminder tools when it needs
 * to read or change settings.
 *
 * Same pattern as buildGroceryContext in grocery/context.ts.
 *
 * @param sqlite - The SQLite database instance
 * @param chatId - The chat ID to look up settings for
 * @returns Formatted context string, or empty string if no settings
 */
export function buildReminderContext(
  sqlite: BetterSqlite3.Database,
  chatId: string,
): string {
  const row = sqlite
    .prepare(
      `SELECT timezone, morning_time, dinner_time, morning_enabled, prep_alerts_enabled, muted_until
       FROM reminder_settings
       WHERE chat_id = ?`,
    )
    .get(chatId) as SettingsContextRow | undefined;

  if (!row) return "";

  const morningStatus = row.morning_enabled ? "enabled" : "disabled";
  const prepStatus = row.prep_alerts_enabled ? "enabled" : "disabled";

  let mutedInfo = "";
  if (row.muted_until != null) {
    const mutedDate = new Date(row.muted_until * 1000);
    if (mutedDate.getTime() > Date.now()) {
      mutedInfo = `, muted until ${mutedDate.toISOString().split("T")[0]}`;
    }
  }

  return `
<reminder_context>
Reminder settings: timezone ${row.timezone}, morning summary at ${row.morning_time} (${morningStatus}), prep alerts (${prepStatus}), dinner time ${row.dinner_time}${mutedInfo}.
</reminder_context>`;
}
