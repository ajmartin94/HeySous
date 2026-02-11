import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Households -- groups of users sharing meal plans, grocery lists, etc.
 * The admin's initial household uses their telegram_id as the ID
 * (deliberate for Phase 16 chatId -> householdId migration compatibility).
 */
export const households = sqliteTable("households", {
  id: text("id").primaryKey(),
  name: text("name").notNull().default("My Household"),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
});

/**
 * Users -- persistent identity for each person using the bot.
 * Each user belongs to exactly one household.
 */
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  telegramId: text("telegram_id").notNull().unique(),
  displayName: text("display_name").notNull(),
  username: text("username"),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  role: text("role", { enum: ["admin", "member"] })
    .notNull()
    .default("member"),
  onboardingState: text("onboarding_state", {
    enum: ["preferences", "tour", "recipes", "tour_only", "complete"],
  })
    .notNull()
    .default("complete"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
