import type { Context } from "grammy";
import type { ParseModeFlavor } from "@grammyjs/parse-mode";
import type { AutoChatActionFlavor } from "@grammyjs/auto-chat-action";
import type { DrizzleDatabase } from "../db/index.js";

export type BotContext = ParseModeFlavor<Context & AutoChatActionFlavor> & {
  db: DrizzleDatabase;
};
