import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  text: text("text").notNull(),
  direction: text("direction", { enum: ["in", "out"] }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tokenUsage = sqliteTable("token_usage", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  chatId: text("chat_id").notNull(),
  userId: text("user_id").notNull(),
  model: text("model").notNull(),
  conversationType: text("conversation_type").notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  cacheCreationTokens: integer("cache_creation_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  estimatedCost: real("estimated_cost").notNull(),
  requestDurationMs: integer("request_duration_ms"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export {
  knowledgeItems,
  knowledgeTags,
  knowledgeChangelog,
} from "../knowledge/schema.js";

export {
  mealPlans,
  mealPlanEntries,
  cookingHistory,
} from "../planning/schema.js";
