/**
 * /invite Admin Command Handler
 *
 * Generates single-use invite deep links for the admin to share.
 *
 * Usage:
 *   /invite              -> Join admin's household (default)
 *   /invite independent  -> Create new solo household for invitee
 *   /invite household:ID -> Join specific household by ID
 */

import { Composer } from "grammy";
import { randomUUID } from "node:crypto";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { createInviteToken } from "../../invites/repository.js";
import { generateToken, generateDeepLink } from "../../invites/deep-link.js";
import { createHousehold, getHouseholdById } from "../../users/repository.js";
import type { CreateInviteParams } from "../../invites/types.js";
import { logger } from "../../logger.js";

interface InviteHandlerDeps {
  sqlite: BetterSqlite3.Database;
  botUsername: string;
}

export function createInviteHandler(deps: InviteHandlerDeps): Composer<BotContext> {
  const composer = new Composer<BotContext>();

  composer.command("invite", async (ctx) => {
    // Admin-only command -- silent rejection for non-admins
    if (ctx.user?.role !== "admin") {
      return;
    }

    const args = ctx.match ? String(ctx.match).trim() : "";
    let targetHouseholdId: string;
    let inviteType: CreateInviteParams["inviteType"] = "household";

    if (!args) {
      // Default: join admin's household
      targetHouseholdId = ctx.user.householdId;
    } else if (args === "independent") {
      // Create a new solo household for the invitee
      const newHouseholdId = randomUUID();
      createHousehold(deps.sqlite, {
        id: newHouseholdId,
        name: "New Household",
        createdBy: ctx.user.telegramId,
      });
      targetHouseholdId = newHouseholdId;
      inviteType = "independent";
    } else if (args.startsWith("household:")) {
      // Join a specific household
      const householdId = args.slice("household:".length).trim();
      const household = getHouseholdById(deps.sqlite, householdId);
      if (!household) {
        await ctx.reply("Household not found.");
        return;
      }
      targetHouseholdId = householdId;
    } else {
      // Unknown flag -- show usage
      await ctx.reply(
        "Usage: /invite, /invite independent, or /invite household:ID",
      );
      return;
    }

    // Generate token and create invite
    const token = generateToken();
    const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

    createInviteToken(deps.sqlite, {
      token,
      householdId: targetHouseholdId,
      inviteType,
      createdBy: ctx.user.telegramId,
      expiresAt,
    });

    // Build deep link URL
    const url = generateDeepLink(deps.botUsername, token);

    await ctx.reply(
      `Invite link (expires in 7 days, single use):\n\n${url}\n\nShare this with the person you want to invite.`,
    );

    logger.info(
      { householdId: targetHouseholdId, inviteType },
      "Invite created",
    );
  });

  return composer;
}
