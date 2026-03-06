import type BetterSqlite3 from "better-sqlite3";

/**
 * Escape a query for FTS5 dedup matching using OR logic.
 * Unlike escapeForFts5 (AND), this finds memories sharing ANY term
 * so that "Dinner is at 7pm" matches "Dinner Time: 6pm".
 */
function escapeForMemoryFts(query: string): string {
  const cleaned = query
    .replace(/[*^"(){}[\]]/g, "")
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, "")
    .trim();

  if (!cleaned) return "";

  const terms = cleaned.split(/\s+/).filter(Boolean);
  // Filter out very short/common words to reduce noise
  const meaningful = terms.filter((t) => t.length > 2);
  if (meaningful.length === 0) return terms.map((t) => `"${t}"`).join(" OR ");
  return meaningful.map((t) => `"${t}"`).join(" OR ");
}

/**
 * Initialize the memories table (raw SQL) and FTS5 virtual table with sync triggers.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 *
 * Same pattern as initializeFts in knowledge/fts.ts -- external content FTS5
 * with INSERT/UPDATE/DELETE triggers to keep the index in sync.
 */
export function initializeMemoryFts(sqlite: BetterSqlite3.Database): void {
  // Ensure base table exists (FTS5 external content needs memories)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      household_id TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(
    `CREATE INDEX IF NOT EXISTS idx_memories_household ON memories(household_id)`,
  );

  // Create FTS5 virtual table with external content mode
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content='memories',
      content_rowid='id',
      tokenize='porter unicode61'
    )
  `);

  // Sync triggers: use DROP IF EXISTS + CREATE pattern since SQLite
  // does not support CREATE TRIGGER IF NOT EXISTS

  // After INSERT trigger -- populate FTS5 when a row is inserted
  sqlite.exec(`DROP TRIGGER IF EXISTS memories_fts_insert`);
  sqlite.exec(`
    CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content)
      VALUES (new.id, new.content);
    END
  `);

  // After DELETE trigger -- remove from FTS5 when a row is deleted
  sqlite.exec(`DROP TRIGGER IF EXISTS memories_fts_delete`);
  sqlite.exec(`
    CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content)
      VALUES ('delete', old.id, old.content);
    END
  `);

  // After UPDATE trigger -- delete old entry and insert new one
  sqlite.exec(`DROP TRIGGER IF EXISTS memories_fts_update`);
  sqlite.exec(`
    CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content)
      VALUES ('delete', old.id, old.content);
      INSERT INTO memories_fts(rowid, content)
      VALUES (new.id, new.content);
    END
  `);

  // Rebuild FTS index to pick up any rows inserted before triggers existed
  // (e.g. migration v10 inserts memories before initializeMemoryFts runs)
  sqlite.exec(`INSERT INTO memories_fts(memories_fts) VALUES('rebuild')`);
}

/**
 * Search memories using FTS5 full-text search with BM25 ranking.
 * Filters by householdId for per-household isolation.
 */
export function searchMemoryFts(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  query: string,
  limit: number = 20,
): Array<{ id: number; content: string; category: string; rank: number }> {
  const escaped = escapeForMemoryFts(query);
  if (!escaped) return [];

  try {
    const rows = sqlite
      .prepare(
        `
      SELECT
        m.id,
        m.content,
        m.category,
        bm25(memories_fts) AS rank
      FROM memories_fts
      JOIN memories m ON m.id = memories_fts.rowid
      WHERE memories_fts MATCH ?
        AND m.household_id = ?
      ORDER BY rank ASC
      LIMIT ?
    `,
      )
      .all(escaped, householdId, limit) as Array<{
      id: number;
      content: string;
      category: string;
      rank: number;
    }>;

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      category: row.category,
      rank: Math.abs(row.rank),
    }));
  } catch {
    // Fallback to LIKE query if FTS5 parse error
    const likePattern = `%${query.replace(/%/g, "\\%")}%`;
    const rows = sqlite
      .prepare(
        `
      SELECT id, content, category
      FROM memories
      WHERE household_id = ?
        AND content LIKE ? ESCAPE '\\'
      ORDER BY updated_at DESC
      LIMIT ?
    `,
      )
      .all(householdId, likePattern, limit) as Array<{
      id: number;
      content: string;
      category: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      category: row.category,
      rank: 0,
    }));
  }
}
