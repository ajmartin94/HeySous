import { Composer } from "grammy";
import type { BotContext } from "../context.js";

export const startHandler = new Composer<BotContext>();

startHandler.command("start", async (ctx) => {
  await ctx.reply(
    "Hey! I'm Sous, your meal planning assistant. I'm still getting set up, but go ahead and say hi!"
  );
});
