import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const knowledgeItems = sqliteTable("knowledge_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  title: text("title").notNull(),
  summary: text("summary").notNull(),
  content: text("content").notNull(),
  source: text("source"),
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
