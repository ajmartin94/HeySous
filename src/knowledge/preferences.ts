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
 * Uses raw SQLite with a single GROUP_CONCAT query (same pattern as
 * recipes.ts) to find knowledge items tagged "preference" and load all
 * their tags in one pass. Ordered by most recently accessed first.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param householdId - Household ID for per-household isolation
 * @param limit - Maximum preferences to return (default 30)
 * @returns Array of PreferenceSummary objects
 */
export function getPreferenceSummaries(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  limit: number = 30,
): PreferenceSummary[] {
  const rows = sqlite
    .prepare(
      `
      SELECT ki.id, ki.title, ki.summary, GROUP_CONCAT(kt_all.tag, ',') AS tags
      FROM knowledge_items ki
      JOIN knowledge_tags kt ON kt.knowledge_item_id = ki.id
      JOIN knowledge_tags kt_all ON kt_all.knowledge_item_id = ki.id
      WHERE ki.household_id = ?
        AND (kt.tag = 'preference' OR kt.tag LIKE 'pref:%' OR kt.tag LIKE 'severity:%')
      GROUP BY ki.id
      ORDER BY ki.last_accessed_at DESC
      LIMIT ?
      `,
    )
    .all(householdId, limit) as Array<{
    id: number;
    title: string;
    summary: string;
    tags: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    tags: row.tags ? row.tags.split(",") : [],
  }));
}
