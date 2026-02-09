import type BetterSqlite3 from "better-sqlite3";

/**
 * Lightweight preference summary for system prompt injection.
 * Preferences are knowledge items tagged with "preference".
 */
export interface PreferenceSummary {
  id: number;
  title: string;
  summary: string;
  tags: string[];
}

/**
 * Retrieve all preference-tagged knowledge items for a chat.
 *
 * Uses raw SQLite (same pattern as fts.ts) with an efficient JOIN query
 * to find knowledge items tagged "preference", ordered by most recently
 * accessed first.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param chatId - Chat ID for per-user isolation
 * @param limit - Maximum preferences to return (default 30)
 * @returns Array of PreferenceSummary objects
 */
export function getPreferenceSummaries(
  sqlite: BetterSqlite3.Database,
  chatId: string,
  limit: number = 30,
): PreferenceSummary[] {
  const rows = sqlite
    .prepare(
      `
      SELECT DISTINCT ki.id, ki.title, ki.summary
      FROM knowledge_items ki
      JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
      WHERE ki.chat_id = ? AND (kt.tag = 'preference' OR kt.tag LIKE 'pref:%' OR kt.tag LIKE 'severity:%')
      ORDER BY ki.last_accessed_at DESC
      LIMIT ?
      `,
    )
    .all(chatId, limit) as Array<{
    id: number;
    title: string;
    summary: string;
  }>;

  // Fetch tags for each preference item (same pattern as searchFts in fts.ts)
  const tagStmt = sqlite.prepare(
    `SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`,
  );

  return rows.map((row) => {
    const tags = (tagStmt.all(row.id) as Array<{ tag: string }>).map(
      (t) => t.tag,
    );
    return {
      id: row.id,
      title: row.title,
      summary: row.summary,
      tags,
    };
  });
}
