import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Meal plans -- one per chat per week.
 * weekStartDate is always a Monday in ISO "YYYY-MM-DD" format.
 */
export const mealPlans = sqliteTable("meal_plans", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  weekStartDate: text("week_start_date").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  version: integer("version").notNull().default(1),
  updatedBy: text("updated_by"),
});

/**
 * Individual meal entries within a plan.
 * dayOfWeek: 0=Monday through 6=Sunday.
 * knowledgeItemId is optional -- links to stored recipe if one exists.
 */
export const mealPlanEntries = sqliteTable("meal_plan_entries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  planId: integer("plan_id")
    .notNull()
    .references(() => mealPlans.id, { onDelete: "cascade" }),
  dayOfWeek: integer("day_of_week").notNull(),
  mealType: text("meal_type", {
    enum: ["breakfast", "lunch", "snack", "dinner", "dessert", "other"],
  })
    .notNull()
    .default("dinner"),
  recipeName: text("recipe_name").notNull(),
  knowledgeItemId: integer("knowledge_item_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Cooking history -- tracks what was actually cooked.
 * source: "planned" = auto-marked from plan, "unplanned" = manually logged.
 */
export const cookingHistory = sqliteTable("cooking_history", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  recipeName: text("recipe_name").notNull(),
  knowledgeItemId: integer("knowledge_item_id"),
  cookedDate: text("cooked_date").notNull(),
  mealType: text("meal_type", {
    enum: ["breakfast", "lunch", "snack", "dinner", "dessert", "other"],
  })
    .notNull()
    .default("dinner"),
  source: text("source", { enum: ["planned", "unplanned"] })
    .notNull()
    .default("planned"),
  notes: text("notes"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
