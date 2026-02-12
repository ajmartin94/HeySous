import type BetterSqlite3 from "better-sqlite3";

/** Raw row shape from the grocery context query. */
interface GroceryContextRow {
  id: number;
  status: string;
  total_items: number;
  checked_items: number;
  stores: string | null;
}

/**
 * Build a lightweight grocery context summary for the system prompt.
 *
 * Returns a short summary of the active grocery list (item count, store count,
 * checked count) to keep system prompt tokens low. Claude calls get_grocery_list
 * when it needs full details.
 *
 * @param sqlite - The SQLite database instance
 * @param householdId - The household ID to look up the active list for
 * @returns Formatted context string, or empty string if no active list
 */
export function buildGroceryContext(
  sqlite: BetterSqlite3.Database,
  householdId: string,
): string {
  const row = sqlite
    .prepare(
      `SELECT gl.id, gl.status,
              COUNT(gli.id) as total_items,
              SUM(CASE WHEN gli.checked = 1 THEN 1 ELSE 0 END) as checked_items,
              GROUP_CONCAT(DISTINCT gli.store) as stores
       FROM grocery_lists gl
       LEFT JOIN grocery_list_items gli ON gli.list_id = gl.id
       WHERE gl.household_id = ? AND gl.status = 'active'
       GROUP BY gl.id
       LIMIT 1`,
    )
    .get(householdId) as GroceryContextRow | undefined;

  if (!row) return "";

  const totalItems = row.total_items ?? 0;
  if (totalItems === 0) return "";

  const checkedItems = row.checked_items ?? 0;
  const storeNames = row.stores ?? "unknown";
  const storeCount = storeNames.split(",").length;

  return `
<grocery_context>
Active grocery list: ${totalItems} items across ${storeCount} store(s) (${storeNames}), ${checkedItems} checked off.
</grocery_context>`;
}
