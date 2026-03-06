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
 * Insert a new memory (atomic fact) for a household.
 * Returns the created memory with its ID.
 */
export function saveMemory(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  content: string,
  category: MemoryCategory = "general",
): { id: number; content: string; category: MemoryCategory } {
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
