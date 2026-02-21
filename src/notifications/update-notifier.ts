/**
 * Update Notification System
 *
 * Handles seeding release notes into the notifications table and
 * lazy delivery of unseen notifications to households.
 *
 * Lazy delivery pattern: when a user sends a message, the processor
 * checks for pending notifications and delivers them before the Claude
 * call. Each household sees each notification exactly once.
 */

import type BetterSqlite3 from "better-sqlite3";
import { RELEASE_NOTES } from "./release-notes.js";

/**
 * Seed any new release notes into the notifications table.
 * Called once on startup. Idempotent (INSERT OR IGNORE on unique version).
 */
export function seedNotifications(sqlite: BetterSqlite3.Database): void {
  const stmt = sqlite.prepare(
    "INSERT OR IGNORE INTO notifications (version, content) VALUES (?, ?)",
  );
  for (const [version, content] of Object.entries(RELEASE_NOTES)) {
    stmt.run(version, content);
  }
}

/**
 * Check for and deliver any unseen notifications to a household.
 * Returns the notification text if one was delivered, null otherwise.
 *
 * Lazy delivery pattern: called during message processing, before the
 * Claude call. Each household sees each notification exactly once.
 */
export function checkPendingNotification(
  sqlite: BetterSqlite3.Database,
  householdId: string,
): string | null {
  // Find the oldest notification not yet delivered to this household
  const pending = sqlite
    .prepare(
      `
    SELECT n.id, n.content
    FROM notifications n
    WHERE n.id NOT IN (
      SELECT notification_id
      FROM notification_deliveries
      WHERE household_id = ?
    )
    ORDER BY n.created_at ASC
    LIMIT 1
  `,
    )
    .get(householdId) as { id: number; content: string } | undefined;

  if (!pending) return null;

  // Record delivery
  sqlite
    .prepare(
      "INSERT INTO notification_deliveries (notification_id, household_id) VALUES (?, ?)",
    )
    .run(pending.id, householdId);

  return pending.content;
}
