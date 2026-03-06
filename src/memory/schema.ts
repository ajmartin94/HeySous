import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Atomic facts about a household.
 * Each row is a single durable fact (e.g. "Allergic to shellfish",
 * "Prefers one-pot meals", "Kids eat dinner at 5:30").
 *
 * Categories classify facts for grouped display and injection:
 * - dietary: allergies, restrictions, diets
 * - taste: flavor preferences, liked/disliked ingredients
 * - cooking_style: equipment, skill level, budget, servings
 * - household: family members, ages, schedules
 * - schedule: meal timing, availability patterns
 * - logistics: stores, delivery preferences, pantry staples
 * - general: anything that doesn't fit above
 */
export const memories = sqliteTable(
  "memories",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    householdId: text("household_id").notNull(),
    content: text("content").notNull(),
    category: text("category", {
      enum: [
        "dietary",
        "taste",
        "cooking_style",
        "household",
        "schedule",
        "logistics",
        "general",
      ],
    })
      .notNull()
      .default("general"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    householdIdx: index("idx_memories_household").on(table.householdId),
  }),
);

export type MemoryCategory =
  | "dietary"
  | "taste"
  | "cooking_style"
  | "household"
  | "schedule"
  | "logistics"
  | "general";

export interface Memory {
  id: number;
  householdId: string;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
  updatedAt: Date;
}
