import { Composer } from "grammy";
import type { BotContext } from "../context.js";

// TODO: Replace with shared formatter from src/telegram/formatter.ts (Plan 03)
function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const messageHandler = new Composer<BotContext>();

messageHandler.on("message:text", async (ctx) => {
  await ctx.reply(escapeHtml(ctx.message.text));
});
