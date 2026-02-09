import { escapeHtml } from "../telegram/formatter.js";
import type { GroceryItem } from "./repository.js";

/**
 * Format a grocery list as HTML for Telegram display.
 *
 * Structure:
 * - Title: bold "Grocery List"
 * - Items grouped by store (bold header), then section (italic header)
 * - Stores sorted alphabetically, sections sorted alphabetically within stores
 * - Within each section: unchecked items first, then checked items
 * - Unchecked items: "  - {quantity} {name}"
 * - Checked items: "  <s>{quantity} {name}</s>" (strikethrough)
 * - Blank line between stores
 *
 * Per user decision: item format is quantity + item only, NO recipe source.
 * Extra items mixed into appropriate sections, NOT a separate section.
 */
export function formatGroceryList(items: GroceryItem[]): string {
  if (items.length === 0) {
    return "<b>Grocery List</b>\n\nNo items yet.";
  }

  const lines: string[] = ["<b>Grocery List</b>", ""];

  // Group items by store, then by section
  const byStore = new Map<string, Map<string, GroceryItem[]>>();
  for (const item of items) {
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

  for (let storeIdx = 0; storeIdx < sortedStores.length; storeIdx++) {
    const storeName = sortedStores[storeIdx];
    const sections = byStore.get(storeName)!;
    const sortedSections = [...sections.keys()].sort();

    lines.push(`<b>${escapeHtml(storeName)}</b>`);

    for (const sectionName of sortedSections) {
      const sectionItems = sections.get(sectionName)!;

      lines.push(`<i>${escapeHtml(sectionName)}</i>`);

      // Sort: unchecked first, then checked (active items visible at top)
      const sorted = [...sectionItems].sort((a, b) => {
        if (a.checked === b.checked) return 0;
        return a.checked ? 1 : -1;
      });

      for (const item of sorted) {
        const qty = item.quantity ? `${item.quantity} ` : "";
        const text = `${qty}${item.name}`;
        if (item.checked) {
          lines.push(`  <s>${escapeHtml(text)}</s>`);
        } else {
          lines.push(`  - ${escapeHtml(text)}`);
        }
      }
    }

    // Blank line between stores (but not after the last one)
    if (storeIdx < sortedStores.length - 1) {
      lines.push("");
    }
  }

  return lines.join("\n");
}

/**
 * One-line summary of grocery list progress.
 * Used in conversational responses after check-off.
 *
 * Example: "5/12 items checked off"
 */
export function formatGroceryListSummary(items: GroceryItem[]): string {
  const total = items.length;
  const checked = items.filter((item) => item.checked).length;
  return `${checked}/${total} items checked off`;
}
