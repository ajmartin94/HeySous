import type BetterSqlite3 from "better-sqlite3";
import type { KnowledgeItem, SearchResult } from "./types.js";

/**
 * Initialize FTS5 virtual table and sync triggers for knowledge_items.
 * Takes the raw better-sqlite3 instance (NOT the Drizzle wrapper).
 *
 * Also ensures the base knowledge tables exist via CREATE TABLE IF NOT EXISTS,
 * since FTS5 external content mode requires the content table to be present.
 * Drizzle schema definitions remain the source of truth for drizzle-kit.
 */
export function initializeFts(sqlite: BetterSqlite3.Database): void {
  // Ensure base tables exist (FTS5 external content needs knowledge_items)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      last_accessed_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledge_item_id INTEGER NOT NULL REFERENCES knowledge_items(id) ON DELETE CASCADE,
      tag TEXT NOT NULL
    )
  `);

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS knowledge_changelog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      knowledge_item_id INTEGER NOT NULL,
      chat_id TEXT NOT NULL,
      action TEXT NOT NULL,
      change_description TEXT,
      previous_content TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    )
  `);

  // Create FTS5 virtual table with external content mode
  sqlite.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
      title,
      summary,
      content,
      content='knowledge_items',
      content_rowid='id',
      tokenize='porter unicode61'
    )
  `);

  // Sync triggers: use DROP IF EXISTS + CREATE pattern since SQLite
  // does not support CREATE TRIGGER IF NOT EXISTS

  // After INSERT trigger -- populate FTS5 when a row is inserted
  sqlite.exec(`DROP TRIGGER IF EXISTS knowledge_fts_insert`);
  sqlite.exec(`
    CREATE TRIGGER knowledge_fts_insert AFTER INSERT ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(rowid, title, summary, content)
      VALUES (new.id, new.title, new.summary, new.content);
    END
  `);

  // After DELETE trigger -- remove from FTS5 when a row is deleted
  sqlite.exec(`DROP TRIGGER IF EXISTS knowledge_fts_delete`);
  sqlite.exec(`
    CREATE TRIGGER knowledge_fts_delete AFTER DELETE ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, title, summary, content)
      VALUES ('delete', old.id, old.title, old.summary, old.content);
    END
  `);

  // After UPDATE trigger -- delete old entry and insert new one
  sqlite.exec(`DROP TRIGGER IF EXISTS knowledge_fts_update`);
  sqlite.exec(`
    CREATE TRIGGER knowledge_fts_update AFTER UPDATE ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, title, summary, content)
      VALUES ('delete', old.id, old.title, old.summary, old.content);
      INSERT INTO knowledge_fts(rowid, title, summary, content)
      VALUES (new.id, new.title, new.summary, new.content);
    END
  `);
}

/**
 * Rebuild the FTS5 index from the content table.
 * Useful for maintenance or after bulk operations.
 */
export function rebuildFtsIndex(sqlite: BetterSqlite3.Database): void {
  sqlite.exec(`INSERT INTO knowledge_fts(knowledge_fts) VALUES('rebuild')`);
}

/**
 * Escape a user query for safe FTS5 MATCH usage.
 * Strips FTS5 operators and wraps each term in double quotes.
 */
export function escapeForFts5(query: string): string {
  // Remove FTS5 special operators: AND, OR, NOT, NEAR, *, ^, "
  const cleaned = query
    .replace(/[*^"(){}[\]]/g, "")
    .replace(/\b(AND|OR|NOT|NEAR)\b/gi, "")
    .trim();

  if (!cleaned) return "";

  // Split into words and wrap each in double quotes for exact matching
  const terms = cleaned.split(/\s+/).filter(Boolean);
  return terms.map((term) => `"${term}"`).join(" ");
}

/**
 * Search knowledge items using FTS5 full-text search with BM25 ranking.
 * Returns lightweight search results (pass 1 of two-pass retrieval).
 * Filters by chatId for per-user knowledge isolation.
 */
export function searchFts(
  sqlite: BetterSqlite3.Database,
  query: string,
  chatId: string,
  limit: number = 10
): SearchResult[] {
  const escaped = escapeForFts5(query);
  if (!escaped) return [];

  try {
    // BM25 weights: title 10x, summary 5x, content 1x
    const rows = sqlite
      .prepare(
        `
      SELECT
        ki.id,
        ki.title,
        ki.summary,
        ki.last_accessed_at,
        bm25(knowledge_fts, 10.0, 5.0, 1.0) AS relevance
      FROM knowledge_fts
      JOIN knowledge_items ki ON ki.id = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
        AND ki.chat_id = ?
      ORDER BY relevance ASC
      LIMIT ?
    `
      )
      .all(escaped, chatId, limit) as Array<{
      id: number;
      title: string;
      summary: string;
      last_accessed_at: number;
      relevance: number;
    }>;

    // Fetch tags for each result
    const tagStmt = sqlite.prepare(
      `SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`
    );

    return rows.map((row) => {
      const tags = (
        tagStmt.all(row.id) as Array<{ tag: string }>
      ).map((t) => t.tag);
      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        relevance: Math.abs(row.relevance),
        tags,
        lastAccessedAt: new Date(row.last_accessed_at * 1000),
      };
    });
  } catch {
    // Fallback to LIKE query if FTS5 parse error (pitfall 1)
    const likePattern = `%${query.replace(/%/g, "\\%")}%`;
    const rows = sqlite
      .prepare(
        `
      SELECT
        ki.id,
        ki.title,
        ki.summary,
        ki.last_accessed_at
      FROM knowledge_items ki
      WHERE ki.chat_id = ?
        AND (ki.title LIKE ? ESCAPE '\\' OR ki.summary LIKE ? ESCAPE '\\')
      ORDER BY ki.last_accessed_at DESC
      LIMIT ?
    `
      )
      .all(chatId, likePattern, likePattern, limit) as Array<{
      id: number;
      title: string;
      summary: string;
      last_accessed_at: number;
    }>;

    const tagStmt = sqlite.prepare(
      `SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`
    );

    return rows.map((row) => {
      const tags = (
        tagStmt.all(row.id) as Array<{ tag: string }>
      ).map((t) => t.tag);
      return {
        id: row.id,
        title: row.title,
        summary: row.summary,
        relevance: 0,
        tags,
        lastAccessedAt: new Date(row.last_accessed_at * 1000),
      };
    });
  }
}

/**
 * Get full knowledge item by ID (pass 2 of two-pass retrieval).
 * Updates last_accessed_at for recency tracking.
 * Filters by chatId for per-user knowledge isolation.
 */
export function getFullItem(
  sqlite: BetterSqlite3.Database,
  id: number,
  chatId: string
): KnowledgeItem | null {
  const now = Math.floor(Date.now() / 1000);

  // Update last_accessed_at
  const updateResult = sqlite
    .prepare(
      `UPDATE knowledge_items SET last_accessed_at = ? WHERE id = ? AND chat_id = ?`
    )
    .run(now, id, chatId);

  if (updateResult.changes === 0) return null;

  // Fetch the item
  const row = sqlite
    .prepare(
      `SELECT id, chat_id, title, summary, content, source, created_at, updated_at, last_accessed_at
       FROM knowledge_items WHERE id = ? AND chat_id = ?`
    )
    .get(id, chatId) as
    | {
        id: number;
        chat_id: string;
        title: string;
        summary: string;
        content: string;
        source: string | null;
        created_at: number;
        updated_at: number;
        last_accessed_at: number;
      }
    | undefined;

  if (!row) return null;

  // Fetch tags
  const tags = (
    sqlite
      .prepare(`SELECT tag FROM knowledge_tags WHERE knowledge_item_id = ?`)
      .all(id) as Array<{ tag: string }>
  ).map((t) => t.tag);

  return {
    id: row.id,
    chatId: row.chat_id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    source: row.source,
    tags,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
    lastAccessedAt: new Date(row.last_accessed_at * 1000),
  };
}
