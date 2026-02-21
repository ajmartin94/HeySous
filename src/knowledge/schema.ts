import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  householdId: text("household_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  source: text("source"),
  sourceUrl: text("source_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  lastAccessedAt: integer("last_accessed_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const knowledgeTags = sqliteTable("knowledge_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  knowledgeItemId: integer("knowledge_item_id")
    .notNull()
    .references(() => knowledgeItems.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
});

/**
 * Changelog for knowledge item mutations.
 * No foreign key on knowledgeItemId -- logs persist even after item deletion.
 * Captures previous content snapshots for audit and data mining.
 */
export const knowledgeChangelog = sqliteTable("knowledge_changelog", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  knowledgeItemId: integer("knowledge_item_id").notNull(),
  householdId: text("household_id").notNull(),
  action: text("action", { enum: ["create", "update", "delete"] }).notNull(),
  changeDescription: text("change_description"),
  previousContent: text("previous_content"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
