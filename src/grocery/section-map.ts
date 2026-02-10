/**
 * Section mapping utilities for grocery list items.
 * Used server-side for auto-assigning sections to quick-add items
 * and for defining the canonical aisle sort order.
 */

/**
 * Fixed aisle order for grocery store sections.
 * Used for display sorting on both server and client.
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

/**
 * Keyword-to-section mapping for auto-assignment.
 * Case-insensitive substring matching against item names.
 */
const SECTION_KEYWORDS: Record<string, string[]> = {
  Produce: [
    "apple",
    "banana",
    "lettuce",
    "tomato",
    "onion",
    "potato",
    "carrot",
    "broccoli",
    "pepper",
    "avocado",
    "lemon",
    "lime",
    "garlic",
    "ginger",
    "cilantro",
    "basil",
    "berries",
    "grapes",
    "orange",
    "celery",
    "cucumber",
    "spinach",
    "kale",
    "mushroom",
  ],
  Dairy: ["milk", "cheese", "yogurt", "butter", "cream", "egg", "sour cream"],
  Meat: [
    "chicken",
    "beef",
    "pork",
    "turkey",
    "salmon",
    "fish",
    "shrimp",
    "bacon",
    "sausage",
    "ground",
  ],
  Bakery: [
    "bread",
    "tortilla",
    "bun",
    "roll",
    "bagel",
    "muffin",
    "croissant",
  ],
  Frozen: ["ice cream", "frozen", "pizza"],
  Pantry: [
    "rice",
    "pasta",
    "flour",
    "sugar",
    "oil",
    "vinegar",
    "sauce",
    "spice",
    "salt",
    "cereal",
    "oat",
    "nut",
  ],
};

/**
 * Guess the grocery section for an item based on keyword matching.
 * Uses case-insensitive substring matching against known keywords.
 * Returns "Other" if no match is found.
 */
export function guessSection(itemName: string): string {
  const lower = itemName.toLowerCase();
  for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return section;
    }
  }
  return "Other";
}
