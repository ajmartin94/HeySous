/**
 * /start Command Handler
 *
 * Processes the /start command with 4-way branching:
 * 1. Existing user, no token (bare /start) -> "Welcome back!"
 * 2. Existing user, with token -> "Welcome back!" (ignore token)
 * 3. New user, valid token -> Register, greet warmly, notify admin
 * 4. New user, no token or invalid token -> Friendly rejection
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import type { User } from "../../users/types.js";
import { getUserByTelegramId, createUser, updateHouseholdName, getAdmin } from "../../users/repository.js";
import { getAndRedeemToken } from "../../invites/repository.js";
import { logger } from "../../logger.js";

interface StartHandlerDeps {
  sqlite: BetterSqlite3.Database;
  addToCache: (user: User) => void;
}

export function createStartHandler(deps: StartHandlerDeps): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.command("start", async (ctx) => {
    const telegramId = String(ctx.from?.id ?? "");
    if (!telegramId) return;

    const displayName = ctx.from?.first_name ?? "there";
    const username = ctx.from?.username ?? null;
    const token = ctx.match ? String(ctx.match) : "";

    // Check if user already exists
    const existingUser = getUserByTelegramId(deps.sqlite, telegramId);

    if (existingUser) {
      // Branch 1 & 2: Existing user (with or without token) -> Welcome back
      await ctx.reply("Welcome back! What can I help you with?");
      return;
    }

    // New user -- need a valid token to register
    if (token) {
      // Branch 3: New user with token -- attempt redemption
      const redeemed = getAndRedeemToken(deps.sqlite, token, telegramId);

      if (redeemed) {
        // Valid token -- register user
        const newUser = createUser(deps.sqlite, {
          telegramId,
          displayName,
          username,
          householdId: redeemed.householdId,
          role: "member",
          onboardingState: "complete",
        });

        // Cache immediately so access gate passes on next message
        deps.addToCache(newUser);

        // Auto-update household name from member names
        updateHouseholdName(deps.sqlite, redeemed.householdId);

        logger.info(
          { telegramId, householdId: redeemed.householdId, inviteType: redeemed.inviteType },
          "New user registered via invite",
        );

        // Warm greeting
        await ctx.reply(
          `Hey ${displayName}! Welcome to HeySous! I'm your meal planning assistant -- I remember recipes, plan weekly dinners, build grocery lists, and send prep reminders. Tell me about a recipe you love, or ask me to plan your week!`,
        );

        // Notify admin (if different from the new user)
        try {
          const admin = getAdmin(deps.sqlite);
          if (admin && admin.telegramId !== telegramId) {
            await ctx.api.sendMessage(
              admin.telegramId,
              `${displayName} just joined your household!`,
            );
          }
        } catch (err) {
          logger.warn({ error: err }, "Failed to notify admin of new user");
        }

        return;
      }

      // Token was invalid/expired/used -- fall through to Branch 4
    }

    // Branch 4: New user, no token or invalid token
    if (token) {
      // Had a token but it was invalid
      await ctx.reply(
        "This invite link is no longer valid. Ask for a new one!",
      );
    } else {
      // No token at all
      await ctx.reply(
        "Hey! I'm an invite-only bot. Ask the person who told you about me for an invite link!",
      );
    }
  });

  return composer;
}
