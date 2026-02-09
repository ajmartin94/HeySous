/**
 * /costs Admin Command Handler
 *
 * Provides token usage summary statistics for admin users.
 * Non-admin users see nothing when running /costs (silent rejection).
 */

import { Composer } from "grammy";
import { count, sum } from "drizzle-orm";
import type { BotContext } from "../context.js";
import { tokenUsage } from "../../db/schema.js";
import { config } from "../../config.js";
import type { DrizzleDatabase } from "../../db/index.js";

/**
 * Create a /costs command handler with database access.
 *
 * Factory pattern consistent with createBot, createProcessor, etc.
 */
export function createCostsHandler(db: DrizzleDatabase): Composer<BotContext> {
  const costsHandler = new Composer<BotContext>();

  costsHandler.command("costs", async (ctx) => {
    // Only visible to admin users -- non-admins see nothing
    // Supports both numeric Telegram user IDs and usernames in ADMIN_USER_IDS
    const numericId = String(ctx.from?.id ?? "");
    const username = ctx.from?.username ?? "";
    const isAdmin = config.adminUserIds.some(
      (adminId) => adminId === numericId || (username && adminId.toLowerCase() === username.toLowerCase())
    );
    if (!isAdmin) {
      return;
    }

    const result = await db
      .select({
        totalRequests: count(),
        totalCost: sum(tokenUsage.estimatedCost),
        totalInputTokens: sum(tokenUsage.inputTokens),
        totalOutputTokens: sum(tokenUsage.outputTokens),
        totalCacheReadTokens: sum(tokenUsage.cacheReadTokens),
        totalCacheCreationTokens: sum(tokenUsage.cacheCreationTokens),
      })
      .from(tokenUsage);

    const row = result[0];
    const totalRequests = row?.totalRequests ?? 0;
    const totalCost = Number(row?.totalCost ?? 0);
    const totalInputTokens = Number(row?.totalInputTokens ?? 0);
    const totalOutputTokens = Number(row?.totalOutputTokens ?? 0);
    const cacheReadTokens = Number(row?.totalCacheReadTokens ?? 0);
    const cacheCreationTokens = Number(row?.totalCacheCreationTokens ?? 0);

    const hitRate =
      totalInputTokens + cacheReadTokens > 0
        ? (cacheReadTokens / (totalInputTokens + cacheReadTokens)) * 100
        : 0;

    const message = [
      "<b>Usage Summary</b>",
      "",
      `Total requests: ${totalRequests}`,
      `Total cost: $${totalCost.toFixed(4)}`,
      `Input tokens: ${totalInputTokens.toLocaleString()}`,
      `Output tokens: ${totalOutputTokens.toLocaleString()}`,
      "",
      "<b>Cache</b>",
      `Cache reads: ${cacheReadTokens.toLocaleString()} tokens`,
      `Cache writes: ${cacheCreationTokens.toLocaleString()} tokens`,
      `Hit rate: ${hitRate.toFixed(1)}%`,
    ].join("\n");

    await ctx.reply(message);
  });

  return costsHandler;
}
