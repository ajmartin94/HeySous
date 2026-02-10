import type { Request, Response } from "express";
import type BetterSqlite3 from "better-sqlite3";
import { createGroceryRepository } from "../../grocery/repository.js";
import { guessSection } from "../../grocery/section-map.js";

/**
 * Factory function for grocery list API route handlers.
 * Returns an object with four handlers: getList, toggleItem, addItem, completeList.
 *
 * Follows the same factory pattern as createSummaryRoute (summary.ts).
 * All handlers expect res.locals.chatId to be set by auth middleware.
 */
export function createGroceryRoutes(sqlite: BetterSqlite3.Database) {
  const repo = createGroceryRepository(sqlite);

  return {
    /**
     * GET /api/grocery
     * Returns items and store names for the authenticated user's active list.
     */
    getList(_req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const list = repo.getActiveList(chatId);

      if (!list) {
        res.json({ items: [], stores: [] });
        return;
      }

      const items = repo.getListItems(list.id);
      const stores = [...new Set(items.map((i) => i.store))];

      res.json({ listId: list.id, items, stores });
    },

    /**
     * POST /api/grocery/toggle
     * Flips an item's checked state and returns the new state.
     */
    toggleItem(req: Request, res: Response) {
      const { itemId } = req.body;

      if (typeof itemId !== "number") {
        res.status(400).json({ error: "itemId required" });
        return;
      }

      const checked = repo.toggleItem(itemId);
      res.json({ itemId, checked });
    },

    /**
     * POST /api/grocery/add
     * Creates a new item on the active list with auto-assigned section if not provided.
     */
    addItem(req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      const { name, quantity, store, section } = req.body;

      if (!name || typeof name !== "string") {
        res.status(400).json({ error: "name required" });
        return;
      }

      const list = repo.getActiveList(chatId);
      if (!list) {
        res.status(404).json({ error: "No active grocery list" });
        return;
      }

      const resolvedSection = section || guessSection(name);

      repo.addItems(list.id, [
        {
          name,
          quantity: quantity || undefined,
          store: store || "Other",
          section: resolvedSection,
        },
      ]);

      const items = repo.getListItems(list.id);
      res.json({ items });
    },

    /**
     * POST /api/grocery/complete
     * Marks the active list as completed.
     */
    completeList(_req: Request, res: Response) {
      const chatId = res.locals.chatId as string;
      repo.completeList(chatId);
      res.json({ ok: true });
    },
  };
}
