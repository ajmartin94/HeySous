import type BetterSqlite3 from "better-sqlite3";

/**
 * A grocery list row from the database.
 */
export interface GroceryList {
  id: number;
  chatId: string;
  planId: number | null;
  messageId: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A grocery list item row from the database.
 */
export interface GroceryItem {
  id: number;
  listId: number;
  name: string;
  quantity: string | null;
  store: string;
  section: string;
  checked: boolean;
  createdAt: Date;
}

/**
 * Input for adding a new grocery item to a list.
 */
export interface NewGroceryItem {
  name: string;
  quantity?: string;
  store: string;
  section: string;
}

/** Raw row shape for grocery_lists from SQLite. */
interface GroceryListRow {
  id: number;
  chat_id: string;
  plan_id: number | null;
  message_id: number | null;
  status: string;
  created_at: number;
  updated_at: number;
}

/** Raw row shape for grocery_list_items from SQLite. */
interface GroceryItemRow {
  id: number;
  list_id: number;
  name: string;
  quantity: string | null;
  store: string;
  section: string;
  checked: number;
  created_at: number;
}

/** Map a raw grocery_lists row to the GroceryList interface. */
function mapList(row: GroceryListRow): GroceryList {
  return {
    id: row.id,
    chatId: row.chat_id,
    planId: row.plan_id,
    messageId: row.message_id,
    status: row.status,
    createdAt: new Date(row.created_at * 1000),
    updatedAt: new Date(row.updated_at * 1000),
  };
}

/** Map a raw grocery_list_items row to the GroceryItem interface. */
function mapItem(row: GroceryItemRow): GroceryItem {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    quantity: row.quantity,
    store: row.store,
    section: row.section,
    checked: row.checked === 1,
    createdAt: new Date(row.created_at * 1000),
  };
}

/**
 * Factory function for grocery list CRUD operations.
 * Uses raw SQLite queries via sqlite.prepare() -- same pattern as
 * fts.ts, preferences.ts, and history.ts.
 */
export function createGroceryRepository(sqlite: BetterSqlite3.Database) {
  return {
    /**
     * Create a new active grocery list for a chat.
     * Deactivates any existing active list first (sets status to 'completed').
     */
    createList(chatId: string, planId?: number): GroceryList {
      // Deactivate any existing active list for this chat
      sqlite
        .prepare(
          `UPDATE grocery_lists SET status = 'completed', updated_at = unixepoch()
           WHERE chat_id = ? AND status = 'active'`,
        )
        .run(chatId);

      // Insert new active list
      const result = sqlite
        .prepare(
          `INSERT INTO grocery_lists (chat_id, plan_id, status)
           VALUES (?, ?, 'active')`,
        )
        .run(chatId, planId ?? null);

      const row = sqlite
        .prepare(`SELECT * FROM grocery_lists WHERE id = ?`)
        .get(result.lastInsertRowid) as GroceryListRow;

      return mapList(row);
    },

    /**
     * Get the active grocery list for a chat.
     * Returns null if no active list exists.
     */
    getActiveList(chatId: string): GroceryList | null {
      const row = sqlite
        .prepare(
          `SELECT * FROM grocery_lists
           WHERE chat_id = ? AND status = 'active'
           ORDER BY created_at DESC LIMIT 1`,
        )
        .get(chatId) as GroceryListRow | undefined;

      return row ? mapList(row) : null;
    },

    /**
     * Get all items for a grocery list, ordered by store, section, then name.
     */
    getListItems(listId: number): GroceryItem[] {
      const rows = sqlite
        .prepare(
          `SELECT * FROM grocery_list_items
           WHERE list_id = ?
           ORDER BY store, section, name`,
        )
        .all(listId) as GroceryItemRow[];

      return rows.map(mapItem);
    },

    /**
     * Batch insert items into a grocery list.
     */
    addItems(listId: number, items: NewGroceryItem[]): void {
      const stmt = sqlite.prepare(
        `INSERT INTO grocery_list_items (list_id, name, quantity, store, section)
         VALUES (?, ?, ?, ?, ?)`,
      );

      const insertMany = sqlite.transaction((itemList: NewGroceryItem[]) => {
        for (const item of itemList) {
          stmt.run(listId, item.name, item.quantity ?? null, item.store, item.section);
        }
      });

      insertMany(items);
    },

    /**
     * Remove items by their IDs.
     */
    removeItems(itemIds: number[]): void {
      if (itemIds.length === 0) return;
      const placeholders = itemIds.map(() => "?").join(",");
      sqlite
        .prepare(`DELETE FROM grocery_list_items WHERE id IN (${placeholders})`)
        .run(...itemIds);
    },

    /**
     * Toggle the checked state of an item.
     * Returns the new checked state.
     */
    toggleItem(itemId: number): boolean {
      sqlite
        .prepare(
          `UPDATE grocery_list_items SET checked = NOT checked WHERE id = ?`,
        )
        .run(itemId);

      const row = sqlite
        .prepare(`SELECT checked FROM grocery_list_items WHERE id = ?`)
        .get(itemId) as { checked: number } | undefined;

      return row ? row.checked === 1 : false;
    },

    /**
     * Mark multiple items as checked.
     */
    checkItems(itemIds: number[]): void {
      if (itemIds.length === 0) return;
      const placeholders = itemIds.map(() => "?").join(",");
      sqlite
        .prepare(
          `UPDATE grocery_list_items SET checked = 1 WHERE id IN (${placeholders})`,
        )
        .run(...itemIds);
    },

    /**
     * Mark multiple items as unchecked.
     */
    uncheckItems(itemIds: number[]): void {
      if (itemIds.length === 0) return;
      const placeholders = itemIds.map(() => "?").join(",");
      sqlite
        .prepare(
          `UPDATE grocery_list_items SET checked = 0 WHERE id IN (${placeholders})`,
        )
        .run(...itemIds);
    },

    /**
     * Store the Telegram message ID for in-place editing.
     */
    setMessageId(listId: number, messageId: number): void {
      sqlite
        .prepare(
          `UPDATE grocery_lists SET message_id = ?, updated_at = unixepoch() WHERE id = ?`,
        )
        .run(messageId, listId);
    },

    /**
     * Look up which list an item belongs to.
     * Returns null if the item doesn't exist.
     */
    getListIdForItem(itemId: number): number | null {
      const row = sqlite
        .prepare(`SELECT list_id FROM grocery_list_items WHERE id = ?`)
        .get(itemId) as { list_id: number } | undefined;

      return row ? row.list_id : null;
    },
  };
}
