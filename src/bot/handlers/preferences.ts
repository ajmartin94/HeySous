/**
 * /preferences Command Handler
 *
 * Displays a formatted list of all stored preferences grouped by category.
 * No admin restriction -- any user can view their own preferences.
 * No Claude API call -- instant and free.
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import {
  getPreferenceSummaries,
  type PreferenceSummary,
} from "../../knowledge/preferences.js";
import { sendFormattedMessage } from "../../telegram/sender.js";

/** Category groups for preference display. */
interface GroupedPreferences {
  dietary: PreferenceSummary[];
  schedule: PreferenceSummary[];
  household: PreferenceSummary[];
  cooking: PreferenceSummary[];
  other: PreferenceSummary[];
}

/**
 * Group preferences by category using tag-based classification.
 *
 * Priority: household > dietary > schedule > cooking > other.
 * Each preference appears in exactly one group.
 */
export function groupPreferences(
  prefs: PreferenceSummary[],
): GroupedPreferences {
  const groups: GroupedPreferences = {
    dietary: [],
    schedule: [],
    household: [],
    cooking: [],
    other: [],
  };

  for (const pref of prefs) {
    const tags = pref.tags;

    if (tags.includes("subject:household")) {
      groups.household.push(pref);
    } else if (tags.includes("pref:dietary")) {
      groups.dietary.push(pref);
    } else if (tags.includes("pref:schedule")) {
      groups.schedule.push(pref);
    } else if (
      tags.includes("pref:cooking") ||
      tags.includes("pref:budget") ||
      tags.includes("pref:serving") ||
      tags.includes("pref:grocery")
    ) {
      groups.cooking.push(pref);
    } else {
      groups.other.push(pref);
    }
  }

  return groups;
}

/**
 * Format a single preference line with appropriate markers.
 *
 * Markers:
 * - [ALLERGY] for severity:allergy
 * - [RESTRICTION] for severity:restriction
 * - [inferred] for inferred preferences
 */
function formatPreferenceLine(pref: PreferenceSummary): string {
  const markers: string[] = [];

  if (pref.tags.includes("severity:allergy")) {
    markers.push("[ALLERGY]");
  }
  if (pref.tags.includes("severity:restriction")) {
    markers.push("[RESTRICTION]");
  }
  if (pref.tags.includes("inferred")) {
    markers.push("[inferred]");
  }

  const markerSuffix = markers.length > 0 ? " " + markers.join(" ") : "";
  return `- <b>${pref.title}</b>${markerSuffix}: ${pref.summary}`;
}

/**
 * Build the formatted HTML message from grouped preferences.
 *
 * Only includes sections that have items. Always includes the footer hint.
 */
function buildPreferencesMessage(groups: GroupedPreferences): string {
  const sections: string[] = ["<b>Your Preferences</b>"];

  const sectionConfig: Array<{
    key: keyof GroupedPreferences;
    label: string;
  }> = [
    { key: "dietary", label: "Dietary" },
    { key: "schedule", label: "Schedule" },
    { key: "household", label: "Household" },
    { key: "cooking", label: "Cooking" },
    { key: "other", label: "Other" },
  ];

  for (const { key, label } of sectionConfig) {
    const items = groups[key];
    if (items.length > 0) {
      const lines = items.map(formatPreferenceLine);
      sections.push(`\n<b>${label}</b>\n${lines.join("\n")}`);
    }
  }

  sections.push(
    '\n<i>Say "forget [preference]" to remove, or tell me if anything changed.</i>',
  );

  return sections.join("\n");
}

/**
 * Create a /preferences command handler with SQLite access.
 *
 * Factory pattern consistent with createCostsHandler, createDebugHandler, etc.
 */
export function createPreferencesHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const preferencesHandler = new Composer<BotContext>();

  preferencesHandler.command("preferences", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const prefs = getPreferenceSummaries(sqlite, chatId);

    if (prefs.length === 0) {
      await ctx.reply(
        'No preferences saved yet! Just tell me things like "we eat dinner at 6pm" or "no shellfish" and I\'ll remember.',
      );
      return;
    }

    const groups = groupPreferences(prefs);
    const message = buildPreferencesMessage(groups);
    await sendFormattedMessage(ctx, message);
  });

  return preferencesHandler;
}
