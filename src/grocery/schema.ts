import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Grocery lists -- one active list per chat at a time.
 * planId is an optional soft link to the meal plan it was generated from (no FK constraint).
 * messageId stores the Telegram message ID for in-place editing of the list.
 */
export const groceryLists = sqliteTable("grocery_lists", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  planId: integer("plan_id"),
  messageId: integer("message_id"),
  status: text("status", { enum: ["draft", "active", "completed"] })
    .notNull()
    .default("active"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Individual items within a grocery list.
 * store and section are freeform text (user-configurable, not enums).
 * quantity is freeform text like "2 lbs", "3", "1 bunch".
 */
export const groceryListItems = sqliteTable("grocery_list_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listId: integer("list_id")
    .notNull()
    .references(() => groceryLists.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  quantity: text("quantity"),
  store: text("store").notNull(),
  section: text("section").notNull(),
  checked: integer("checked", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
