import type BetterSqlite3 from "better-sqlite3";
import type { Memory, MemoryCategory } from "./schema.js";

/** Raw row shape from the memories table. */
interface MemoryRow {
  id: number;
  household_id: string;
  content: string;
  category: string;
  created_at: number;
  updated_at: number;
}

/** Map a raw memories row to the Memory interface. */
function mapMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    householdId: row.household_id,
    content: row.content,
    category: row.category as MemoryCategory,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

/**
 * Normalize content for exact-duplicate comparison: trim, lowercase, and
 * collapse any run of whitespace (spaces, tabs, newlines) to a single space.
 * Used so that saves differing only in case or incidental whitespace are
 * still recognized as the same fact.
 */
function normalizeContent(content: string): string {
  return content.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find an existing memory in the household whose content is identical to
 * `content` once normalized (case/whitespace-insensitive). This is a plain
 * JS comparison over the household's rows -- it does NOT go through FTS5,
 * so it can never be defeated by FTS5 query-syntax edge cases (punctuation,
 * reserved characters, term-count-dependent BM25 scaling, etc). Household
 * memory counts are small (bounded ~200 by product design), so the full
 * per-household scan is cheap.
 */
export function findExactMemoryMatch(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  content: string,
): Memory | null {
  const target = normalizeContent(content);
  if (!target) return null;

  const rows = sqlite
    .prepare(`SELECT * FROM memories WHERE household_id = ?`)
    .all(householdId) as MemoryRow[];

  const match = rows.find((row) => normalizeContent(row.content) === target);
  return match ? mapMemory(match) : null;
}

/**
 * Insert a new memory (atomic fact) for a household.
 * Returns the created memory with its ID.
 *
 * Guards against exact duplicates (case/whitespace-insensitive) as a hard
 * safety net: if a memory with identical normalized content already exists
 * for this household, no new row is inserted -- the existing row is
 * returned instead (with `duplicate: true`). This check is independent of
 * the FTS5-based fuzzy dedup performed upstream (see src/ai/tool-handler.ts)
 * and cannot be bypassed by FTS5 query-syntax issues.
 */
export function saveMemory(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  content: string,
  category: MemoryCategory = "general",
): { id: number; content: string; category: MemoryCategory; duplicate?: boolean } {
  const existing = findExactMemoryMatch(sqlite, householdId, content);
  if (existing) {
    return {
      id: existing.id,
      content: existing.content,
      category: existing.category,
      duplicate: true,
    };
  }

  const result = sqlite
    .prepare(
      `INSERT INTO memories (household_id, content, category)
       VALUES (?, ?, ?)`,
    )
    .run(householdId, content, category);

  return {
    id: Number(result.lastInsertRowid),
    content,
    category,
  };
}

/**
 * Update the content of an existing memory.
 * Sets updated_at to current time.
 */
export function updateMemory(
  sqlite: BetterSqlite3.Database,
  id: number,
  content: string,
): boolean {
  const result = sqlite
    .prepare(
      `UPDATE memories SET content = ?, updated_at = unixepoch() WHERE id = ?`,
    )
    .run(content, id);

  return result.changes > 0;
}

/**
 * Delete a memory by ID with household_id guard.
 * Returns true if a row was deleted.
 */
export function deleteMemory(
  sqlite: BetterSqlite3.Database,
  id: number,
  householdId: string,
): boolean {
  const result = sqlite
    .prepare(`DELETE FROM memories WHERE id = ? AND household_id = ?`)
    .run(id, householdId);

  return result.changes > 0;
}

/**
 * Get all memories for a household, ordered by category then created_at DESC.
 * Default limit 200.
 */
export function getMemoriesByHousehold(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  limit: number = 200,
): Memory[] {
  const rows = sqlite
    .prepare(
      `SELECT * FROM memories
       WHERE household_id = ?
       ORDER BY category ASC, created_at DESC
       LIMIT ?`,
    )
    .all(householdId, limit) as MemoryRow[];

  return rows.map(mapMemory);
}

/**
 * Get a single memory by ID with household_id guard.
 */
export function getMemoryById(
  sqlite: BetterSqlite3.Database,
  id: number,
  householdId: string,
): Memory | null {
  const row = sqlite
    .prepare(`SELECT * FROM memories WHERE id = ? AND household_id = ?`)
    .get(id, householdId) as MemoryRow | undefined;

  return row ? mapMemory(row) : null;
}
