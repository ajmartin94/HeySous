import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import { escapeHtml } from "../../telegram/formatter.js";
import { sendFormattedMessage } from "../../telegram/sender.js";

export const messageHandler = new Composer<BotContext>();

messageHandler.on("message:text", async (ctx) => {
  const userText = ctx.message.text;
  const safeText = escapeHtml(userText);
  // Phase 1 echo mode -- Phase 2 replaces this with Claude responses
  const response = `You said: ${safeText}`;
  await sendFormattedMessage(ctx, response);
});
