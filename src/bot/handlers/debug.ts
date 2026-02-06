/**
 * /debug Command Handler
 *
 * Surfaces knowledge retrieval metrics from the most recent search.
 * No admin restriction -- power user feature per user decision.
 */

import { Composer } from "grammy";
import type { BotContext } from "../context.js";
import type { createRetrievalService } from "../../knowledge/retrieval.js";

/**
 * Create a /debug command handler with retrieval service access.
 *
 * Factory pattern consistent with createCostsHandler, createMessageHandler, etc.
 */
export function createDebugHandler(
  retrievalService: ReturnType<typeof createRetrievalService>,
): Composer<BotContext> {
  const debugHandler = new Composer<BotContext>();

  debugHandler.command("debug", async (ctx) => {
    const metrics = retrievalService.getMetrics();

    // If all zeros, no search has been performed yet
    if (
      metrics.itemsSearched === 0 &&
      metrics.itemsReturned === 0 &&
      metrics.tokensUsed === 0 &&
      metrics.queryTimeMs === 0
    ) {
      await ctx.reply(
        "No retrieval stats yet -- send a message first!",
      );
      return;
    }

    const message = [
      "<b>Last Retrieval Stats</b>",
      "",
      `Items searched: ${metrics.itemsSearched}`,
      `Items returned: ${metrics.itemsReturned}`,
      `Tokens used: ${metrics.tokensUsed}`,
      `Query time: ${metrics.queryTimeMs}ms`,
    ].join("\n");

    await ctx.reply(message);
  });

  return debugHandler;
}
