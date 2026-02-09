import { InlineKeyboard } from "grammy";
import type { GroceryItem } from "./repository.js";

/** Prefix for all grocery-related callback data. */
export const GROCERY_CB_PREFIX = "g:";

/**
 * Encode a toggle action for a grocery item into compact callback data.
 * Format: "g:t:{itemId}" -- well under the 64-byte Telegram limit.
 *
 * Example: encodeToggle(42) returns "g:t:42"
 */
export function encodeToggle(itemId: number): string {
  return `${GROCERY_CB_PREFIX}t:${itemId}`;
}

/**
 * Parse a grocery callback data string into its action and item ID.
 * Returns null if the data is not a grocery callback or parsing fails.
 *
 * Example: parseGroceryCallback("g:t:42") returns { action: "t", itemId: 42 }
 */
export function parseGroceryCallback(
  data: string,
): { action: string; itemId: number } | null {
  if (!data.startsWith(GROCERY_CB_PREFIX)) return null;

  const remainder = data.slice(GROCERY_CB_PREFIX.length);
  const parts = remainder.split(":");
  if (parts.length !== 2) return null;

  const itemId = parseInt(parts[1], 10);
  if (isNaN(itemId)) return null;

  return { action: parts[0], itemId };
}

/**
 * Build an InlineKeyboard with toggle buttons for unchecked grocery items.
 *
 * - Only unchecked items get buttons (checked items are strikethrough text)
 * - Items are grouped by store, then section within each store
 * - 2 buttons per row for mobile readability
 * - If more than 80 unchecked items, returns an empty keyboard
 *   (falls back to conversational check-off to stay under Telegram's 100-button limit)
 */
export function buildGroceryKeyboard(items: GroceryItem[]): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const uncheckedItems = items.filter((item) => !item.checked);

  // Safety valve: skip buttons entirely for very large lists
  if (uncheckedItems.length > 80) {
    return keyboard;
  }

  // Group by store, then by section within each store
  const byStore = new Map<string, Map<string, GroceryItem[]>>();
  for (const item of uncheckedItems) {
    if (!byStore.has(item.store)) {
      byStore.set(item.store, new Map());
    }
    const storeSections = byStore.get(item.store)!;
    if (!storeSections.has(item.section)) {
      storeSections.set(item.section, []);
    }
    storeSections.get(item.section)!.push(item);
  }

  // Sort stores alphabetically
  const sortedStores = [...byStore.keys()].sort();

  for (const storeName of sortedStores) {
    const sections = byStore.get(storeName)!;
    const sortedSections = [...sections.keys()].sort();

    for (const sectionName of sortedSections) {
      const sectionItems = sections.get(sectionName)!;
      let countInRow = 0;

      for (const item of sectionItems) {
        const label = item.quantity
          ? `${item.quantity} ${item.name}`
          : item.name;

        // Truncate label to keep it readable on mobile (max ~30 chars)
        const truncated =
          label.length > 30 ? label.slice(0, 27) + "..." : label;

        keyboard.text(truncated, encodeToggle(item.id));
        countInRow++;

        // 2 buttons per row for mobile readability
        if (countInRow % 2 === 0) {
          keyboard.row();
        }
      }

      // End row after section if odd count (ensures clean section break)
      if (countInRow % 2 !== 0) {
        keyboard.row();
      }
    }
  }

  return keyboard;
}
