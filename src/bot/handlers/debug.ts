/**
 * /debug Command Handler
 *
 * Subcommands:
 *   /debug         -- knowledge retrieval stats (original behavior)
 *   /debug time    -- show current clock time in UTC and user's local timezone
 *   /debug time set <datetime> -- set clock (interpreted in user's timezone)
 *   /debug time advance <duration> -- advance clock (e.g. 10m, 1h, 30s)
 *   /debug time reset -- reset to real time
 *   /debug tick    -- force a reminder poller tick
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import type { createRetrievalService } from "../../knowledge/retrieval.js";
import type { createReminderRepository } from "../../reminders/repository.js";
import type { TestClock } from "../../clock.js";
import type { Clock } from "../../clock.js";

interface DebugHandlerDeps {
  retrievalService: ReturnType<typeof createRetrievalService>;
  reminderRepository: ReturnType<typeof createReminderRepository>;
  sqlite: BetterSqlite3.Database;
  clock: Clock;
  isDev: boolean;
  pollerTick?: () => Promise<void>;
  regenerateReminders?: (householdId: string) => void;
}

function isTestClock(clock: Clock): clock is TestClock {
  return "set" in clock && "advance" in clock && "reset" in clock;
}

function parseDuration(s: string): number | null {
  const match = s.match(/^(\d+)(s|m|h)$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "s") return value * 1000;
  if (unit === "m") return value * 60_000;
  if (unit === "h") return value * 3_600_000;
  return null;
}

/**
 * Format a Date in a specific timezone for display.
 */
function formatInTimezone(date: Date, timezone: string): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

/**
 * Convert a local datetime string in a timezone to a UTC Date.
 * Input: "2026-02-09T08:01:00" + "America/New_York" → Date at 13:01:00 UTC
 */
function localDatetimeToUtc(dateTimeStr: string, timezone: string): Date {
  // Parse as if UTC to get reference point
  const refDate = new Date(dateTimeStr + "Z");
  if (isNaN(refDate.getTime())) return new Date(NaN);

  // Find the UTC offset for this timezone at this moment
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(refDate);
  const getPart = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAtRef = new Date(
    Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour") === 24 ? 0 : getPart("hour"),
      getPart("minute"),
      getPart("second"),
    ),
  );

  // offset = what timezone shows - what UTC actually is
  const offsetMs = localAtRef.getTime() - refDate.getTime();

  // Subtract offset: local time - offset = UTC
  return new Date(refDate.getTime() - offsetMs);
}

export function createDebugHandler(deps: DebugHandlerDeps): Composer<BotContext> {
  const { retrievalService, reminderRepository, sqlite, clock, isDev, pollerTick, regenerateReminders } = deps;
  const debugHandler = new Composer<BotContext>();

  debugHandler.command("debug", async (ctx) => {
    const householdId = ctx.householdId!;
    const chatId = String(ctx.chat.id);
    const args = (ctx.match as string || "").trim();

    // Look up user's timezone (used by time subcommands)
    const getUserTimezone = (): string => {
      const settings = reminderRepository.getSettings(householdId);
      return settings?.timezone ?? "UTC";
    };

    // /debug tick -- force a poller tick with diagnostics
    if (args === "tick") {
      if (!isDev) {
        await ctx.reply("Debug tick is only available in dev mode.");
        return;
      }
      if (!pollerTick) {
        await ctx.reply("Poller tick not available.");
        return;
      }

      const tz = getUserTimezone();
      const nowSec = Math.floor(clock.now() / 1000);

      // Check what's due BEFORE tick
      const dueBefore = sqlite
        .prepare(
          `SELECT id, type, status, due_at FROM reminders
           WHERE household_id = ? AND status = 'pending' AND due_at <= ?
           ORDER BY due_at ASC`,
        )
        .all(householdId, nowSec) as Array<{ id: number; type: string; status: string; due_at: number }>;

      await pollerTick();

      // Check what changed AFTER tick
      const afterRows = dueBefore.length > 0
        ? (sqlite
            .prepare(
              `SELECT id, type, status FROM reminders WHERE id IN (${dueBefore.map(() => "?").join(",")})`,
            )
            .all(...dueBefore.map((r) => r.id)) as Array<{ id: number; type: string; status: string }>)
        : [];

      const lines: string[] = [
        `Clock: ${formatInTimezone(clock.date(), tz)} (${tz})`,
        `Due before tick: ${dueBefore.length}`,
      ];

      for (const r of dueBefore) {
        const after = afterRows.find((a) => a.id === r.id);
        const localDue = formatInTimezone(new Date(r.due_at * 1000), tz);
        lines.push(`  #${r.id} ${r.type} due ${localDue} → ${after?.status ?? "?"}`);
      }

      if (dueBefore.length === 0) {
        // Show ALL pending reminders for context
        const allPending = sqlite
          .prepare(
            `SELECT id, type, due_at FROM reminders
             WHERE household_id = ? AND status = 'pending'
             ORDER BY due_at ASC LIMIT 5`,
          )
          .all(householdId) as Array<{ id: number; type: string; due_at: number }>;

        if (allPending.length > 0) {
          lines.push("Pending (not yet due):");
          for (const r of allPending) {
            const localDue = formatInTimezone(new Date(r.due_at * 1000), tz);
            const diffMin = Math.round((r.due_at - nowSec) / 60);
            lines.push(`  #${r.id} ${r.type} due ${localDue} (in ${diffMin}m)`);
          }
        } else {
          lines.push("No pending reminders at all.");
        }
      }

      await ctx.reply(lines.join("\n"));
      return;
    }

    // /debug reminders -- dump reminder DB state for this chat
    if (args === "reminders") {
      if (!isDev) {
        await ctx.reply("Debug reminders is only available in dev mode.");
        return;
      }
      const tz = getUserTimezone();
      const nowSec = Math.floor(clock.now() / 1000);

      const rows = sqlite
        .prepare(
          `SELECT id, type, status, due_at, context_json
           FROM reminders WHERE household_id = ?
           ORDER BY due_at ASC LIMIT 20`,
        )
        .all(householdId) as Array<{
        id: number;
        type: string;
        status: string;
        due_at: number;
        context_json: string;
      }>;

      if (rows.length === 0) {
        await ctx.reply(`No reminders in DB for this chat.\nClock now: ${nowSec} (unix)`);
        return;
      }

      const lines = rows.map((r) => {
        const dueDate = new Date(r.due_at * 1000);
        const localDue = formatInTimezone(dueDate, tz);
        const isDue = r.due_at <= nowSec ? "DUE" : `in ${Math.round((r.due_at - nowSec) / 60)}m`;
        return `${r.id}: ${r.type} [${r.status}] ${localDue} (${isDue})`;
      });

      await ctx.reply(
        `<b>Reminders</b> (clock: ${formatInTimezone(clock.date(), tz)})\n\n${lines.join("\n")}`,
        { parse_mode: "HTML" },
      );
      return;
    }

    // /debug regen -- force reminder regeneration for this chat
    if (args === "regen") {
      if (!isDev) {
        await ctx.reply("Debug regen is only available in dev mode.");
        return;
      }
      if (!regenerateReminders) {
        await ctx.reply("Regenerate function not available.");
        return;
      }
      regenerateReminders(householdId);
      const tz = getUserTimezone();
      const localTime = formatInTimezone(clock.date(), tz);
      await ctx.reply(`Reminders regenerated for this chat at ${localTime} (${tz}).`);
      return;
    }

    // /debug time ... -- clock control
    if (args === "time" || args.startsWith("time ")) {
      const timeArgs = args.slice(5).trim();
      const tz = getUserTimezone();

      // /debug time -- show current time
      if (!timeArgs) {
        const now = clock.date();
        const mode = isTestClock(clock) ? "test clock" : "real clock";
        const localTime = formatInTimezone(now, tz);
        await ctx.reply(
          `<b>Clock</b>\nMode: ${mode}\nUTC: ${now.toISOString()}\nLocal (${tz}): ${localTime}`,
          { parse_mode: "HTML" },
        );
        return;
      }

      if (!isDev) {
        await ctx.reply("Clock control is only available in dev mode.");
        return;
      }

      if (!isTestClock(clock)) {
        await ctx.reply("Clock is not controllable. Start with a test clock to use time commands.");
        return;
      }

      // /debug time set <datetime>
      if (timeArgs.startsWith("set ")) {
        const dateStr = timeArgs.slice(4).trim();

        // Convert from user's local timezone to UTC
        const parsed = localDatetimeToUtc(dateStr, tz);
        if (isNaN(parsed.getTime())) {
          await ctx.reply(`Invalid date: "${dateStr}". Use format like 2026-02-09T19:00:00`);
          return;
        }
        clock.set(parsed);
        const localTime = formatInTimezone(clock.date(), tz);
        await ctx.reply(
          `Clock set to ${localTime} (${tz})\nUTC: ${clock.date().toISOString()}`,
        );
        return;
      }

      // /debug time advance <duration>
      if (timeArgs.startsWith("advance ")) {
        const durStr = timeArgs.slice(8).trim();
        const ms = parseDuration(durStr);
        if (ms === null) {
          await ctx.reply(`Invalid duration: "${durStr}". Use format like 10m, 1h, or 30s.`);
          return;
        }
        clock.advance(ms);
        const localTime = formatInTimezone(clock.date(), tz);
        await ctx.reply(
          `Clock advanced to ${localTime} (${tz})\nUTC: ${clock.date().toISOString()}`,
        );
        return;
      }

      // /debug time reset
      if (timeArgs === "reset") {
        clock.reset();
        const localTime = formatInTimezone(clock.date(), tz);
        await ctx.reply(
          `Clock reset to real time: ${localTime} (${tz})\nUTC: ${clock.date().toISOString()}`,
        );
        return;
      }

      await ctx.reply("Usage: /debug time [set <datetime>|advance <duration>|reset]");
      return;
    }

    // Default: knowledge retrieval stats (original behavior)
    const metrics = retrievalService.getMetrics(householdId);

    if (
      metrics.itemsSearched === 0 &&
      metrics.itemsReturned === 0 &&
      metrics.tokensUsed === 0 &&
      metrics.queryTimeMs === 0
    ) {
      await ctx.reply(
        "No retrieval stats for this chat yet. Send a message that triggers a knowledge search (ask about your recipes, preferences, or meal plans) and check again!",
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
