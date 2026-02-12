import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { households } from "../users/schema.js";

/**
 * Invite tokens -- single-use tokens for inviting new users.
 * Each token is tied to a household. When redeemed, the new user
 * joins that household.
 */
export const inviteTokens = sqliteTable("invite_tokens", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  householdId: text("household_id")
    .notNull()
    .references(() => households.id),
  inviteType: text("invite_type", { enum: ["household", "independent"] })
    .notNull()
    .default("household"),
  createdBy: text("created_by").notNull(),
  redeemedBy: text("redeemed_by"),
  redeemedAt: integer("redeemed_at"),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});
