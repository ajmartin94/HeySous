/**
 * Client-side section sort order constants for grocery list rendering.
 * Duplicated from server-side src/grocery/section-map.ts because
 * server and client modules cannot share imports across the build boundary.
 *
 * Note: guessSection is intentionally omitted here -- section assignment
 * happens server-side in the addItem API route.
 */

/**
 * Fixed aisle order for grocery store sections.
 * Used for sorting section groups in the grocery list UI.
 */
export const SECTION_ORDER: Record<string, number> = {
  Produce: 0,
  Dairy: 1,
  Meat: 2,
  Bakery: 3,
  Frozen: 4,
  Pantry: 5,
  Other: 6,
};

/**
 * Returns a numeric sort key for a section name.
 * Unknown sections sort after "Other" (returns 99).
 */
export function sectionSortKey(section: string): number {
  return SECTION_ORDER[section] ?? 99;
}
