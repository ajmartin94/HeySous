/**
 * Access Gate Middleware
 *
 * Blocks unregistered users from interacting with the bot.
 * Only /start is allowed through unconditionally (it is the registration entry point).
 * Registered users get their identity injected into the BotContext.
 */

import type BetterSqlite3 from "better-sqlite3";
import type { MiddlewareFn } from "grammy";
import type { BotContext } from "../context.js";
import { getUserByTelegramId } from "../../users/repository.js";
import type { User } from "../../users/types.js";
import { logger } from "../../logger.js";

interface AccessGateDeps {
  sqlite: BetterSqlite3.Database;
}

interface AccessGateResult {
  middleware: MiddlewareFn<BotContext>;
  addToCache: (user: User) => void;
  refreshUserCache: (user: User) => void;
}

export function createAccessGate(deps: AccessGateDeps): AccessGateResult {
  const userCache = new Map<string, User>();

  function addToCache(user: User): void {
    userCache.set(user.telegramId, user);
  }

  const middleware: MiddlewareFn<BotContext> = (ctx, next) => {
    // Always allow /start through -- it is the registration entry point
    if (ctx.message?.text?.startsWith("/start")) {
      return next();
    }

    const telegramId = String(ctx.from?.id ?? "");
    if (!telegramId) {
      return; // No user context at all (e.g., channel posts)
    }

    // Check cache first, then DB
    let user = userCache.get(telegramId);
    if (!user) {
      user = getUserByTelegramId(deps.sqlite, telegramId);
      if (user) {
        userCache.set(telegramId, user);
      }
    }

    if (!user) {
      logger.debug({ telegramId }, "Access gate: unregistered user blocked");
      return ctx.reply(
        "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!",
      );
    }

    // Inject identity into context for downstream handlers
    ctx.userId = user.telegramId;
    ctx.householdId = user.householdId;
    ctx.user = user;
    return next();
  };

  /** Semantic alias for addToCache -- makes pipeline call sites clearer. */
  function refreshUserCache(user: User): void {
    addToCache(user);
  }

  return { middleware, addToCache, refreshUserCache };
}
