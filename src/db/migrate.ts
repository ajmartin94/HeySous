import type BetterSqlite3 from "better-sqlite3";
import { logger } from "../logger.js";

/**
 * Idempotent migration: rename chat_id -> household_id across all data tables.
 *
 * Checks PRAGMA table_info(knowledge_items) for a column named "chat_id".
 * If absent, the migration has already run -- returns early.
 * Otherwise, renames the column in all 9 data-owning tables within a single
 * transaction for atomicity.
 *
 * IMPORTANT: The `messages` table keeps its `chat_id` column because
 * conversation history is per-Telegram-chat, not per-household.
 *
 * IMPORTANT: The `knowledge_tags` table has no `chat_id` column -- skip it.
 */
export function migrateToHouseholdId(sqlite: BetterSqlite3.Database): void {
  const tableInfo = sqlite
    .prepare("PRAGMA table_info(knowledge_items)")
    .all() as Array<{ name: string }>;

  const hasChatId = tableInfo.some((col) => col.name === "chat_id");

  if (!hasChatId) {
    // Already migrated or fresh database -- nothing to do
    return;
  }

  logger.info("Starting chat_id -> household_id column migration...");

  sqlite.transaction(() => {
    sqlite.exec(
      `ALTER TABLE knowledge_items RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE knowledge_changelog RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE meal_plans RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE cooking_history RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE grocery_lists RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE reminder_settings RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE reminders RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE feedback_checkins RENAME COLUMN chat_id TO household_id`,
    );
    sqlite.exec(
      `ALTER TABLE token_usage RENAME COLUMN chat_id TO household_id`,
    );
  })();

  logger.info(
    "Migration complete: chat_id -> household_id renamed in 9 tables",
  );
}
