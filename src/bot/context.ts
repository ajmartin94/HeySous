import type { Context } from "grammy";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { DrizzleDatabase } from "../db/index.js";
import type { User } from "../users/types.js";

export type BotContext = ParseModeFlavor<Context & AutoChatActionFlavor> & {
  db: DrizzleDatabase;
  /** Telegram user ID string, set by access gate for registered users */
  userId?: string;
  /** Resolved household ID, set by access gate for registered users */
  householdId?: string;
  /** Full user record from DB, set by access gate for registered users */
  user?: User;
};
