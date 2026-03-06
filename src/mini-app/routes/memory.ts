import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import {
  getMemoriesByHousehold,
  deleteMemory,
} from "../../memory/repository.js";
import type { MemoryCategory } from "../../memory/schema.js";

interface CategoryGroup {
  name: MemoryCategory;
  memories: Array<{ id: number; content: string }>;
}

/**
 * Factory function for memory API routes.
 * Returns handlers for GET /api/memories and DELETE /api/memories/:id.
 */
export function createMemoryRoutes(sqlite: BetterSqlite3.Database) {
  const getAll = (_req: Request, res: Response) => {
    const householdId = res.locals.householdId as string;
    const memories = getMemoriesByHousehold(sqlite, householdId);

    // Group by category preserving order
    const categoryMap = new Map<MemoryCategory, Array<{ id: number; content: string }>>();
    for (const mem of memories) {
      const existing = categoryMap.get(mem.category);
      const item = { id: mem.id, content: mem.content };
      if (existing) {
        existing.push(item);
      } else {
        categoryMap.set(mem.category, [item]);
      }
    }

    const categories: CategoryGroup[] = [];
    for (const [name, mems] of categoryMap) {
      categories.push({ name, memories: mems });
    }

    res.json({ categories });
  };

  const deleteOne = (req: Request, res: Response) => {
    const householdId = res.locals.householdId as string;
    const id = Number(req.params.id);

    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid memory ID" });
      return;
    }

    const deleted = deleteMemory(sqlite, id, householdId);
    if (deleted) {
      res.json({ ok: true });
    } else {
      res.status(404).json({ error: "Memory not found" });
    }
  };

  return { getAll, deleteOne };
}
