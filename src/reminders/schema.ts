import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Per-chat reminder settings with timezone and preferred notification times.
 * One row per household (UNIQUE on household_id enforced in init.ts).
 */
export const reminderSettings = sqliteTable("application_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  morningTime: text("morning_time").notNull().default("08:00"),
  dinnerTime: text("dinner_time").notNull().default("17:30"),
  morningEnabled: integer("morning_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  prepAlertsEnabled: integer("prep_alerts_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  mutedUntil: integer("muted_until", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

/**
 * Individual scheduled reminders.
 * Each reminder has a type, due time, and context for Claude to generate text.
 */
export const reminders = sqliteTable("reminders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  type: text("type", {
    enum: ["morning_summary", "prep_alert", "start_cooking"],
  }).notNull(),
  dueAt: integer("due_at", { mode: "timestamp" }).notNull(),
  status: text("status", {
    enum: ["pending", "sent", "failed"],
  })
    .notNull()
    .default("pending"),
  contextJson: text("context_json").notNull(),
  generatedText: text("generated_text"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
