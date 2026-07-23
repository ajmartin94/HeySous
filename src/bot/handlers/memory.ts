/**
 * /memory Command Handler
 *
 * Displays all stored memories (atomic facts) grouped by category.
 * Also handles the legacy /preferences alias.
 * No admin restriction -- any user can view their own memories.
 * No Claude API call -- instant and free.
 */

import { Composer } from "grammy";
import type BetterSqlite3 from "better-sqlite3";
import type { BotContext } from "../context.js";
import { getMemoriesByHousehold } from "../../memory/repository.js";
import type { Memory, MemoryCategory } from "../../memory/schema.js";
import { sendFormattedMessage } from "../../telegram/sender.js";
import { escapeHtml } from "../../telegram/formatter.js";

/** Category display order and labels. */
const categoryConfig: Array<{ key: MemoryCategory; label: string }> = [
  { key: "dietary", label: "Dietary" },
  { key: "taste", label: "Taste" },
  { key: "cooking_style", label: "Cooking Style" },
  { key: "household", label: "Household" },
  { key: "schedule", label: "Schedule" },
  { key: "logistics", label: "Logistics" },
  { key: "general", label: "General" },
];

/**
 * Group memories by category using a Map.
 */
function groupMemories(
  memories: Memory[],
): Map<MemoryCategory, Memory[]> {
  const groups = new Map<MemoryCategory, Memory[]>();
  for (const mem of memories) {
    const existing = groups.get(mem.category);
    if (existing) {
      existing.push(mem);
    } else {
      groups.set(mem.category, [mem]);
    }
  }
  return groups;
}

/**
 * Build the formatted HTML message from grouped memories.
 * Only includes categories that have items.
 */
function buildMemoryMessage(groups: Map<MemoryCategory, Memory[]>): string {
  const sections: string[] = ["<b>Your Memory</b>"];

  for (const { key, label } of categoryConfig) {
    const items = groups.get(key);
    if (items && items.length > 0) {
      const lines = items.map((m) => `- ${escapeHtml(m.content)}`);
      sections.push(`\n<b>${label}</b>\n${lines.join("\n")}`);
    }
  }

  sections.push(
    '\n<i>To change a memory, just tell me in chat. To remove one, say "forget [fact]".</i>',
  );

  return sections.join("\n");
}

/**
 * Create a /memory command handler with SQLite access.
 * Handles both /memory and /preferences commands.
 */
export function createMemoryHandler(
  sqlite: BetterSqlite3.Database,
): Composer<BotContext> {
  const handler = new Composer<BotContext>();

  handler.command(["memory", "preferences"], async (ctx) => {
    const householdId = ctx.householdId!;
    const memories = getMemoriesByHousehold(sqlite, householdId);

    if (memories.length === 0) {
      await ctx.reply(
        "No memories saved yet! Just chat with me and I'll remember the important things about your preferences and household.",
      );
      return;
    }

    const groups = groupMemories(memories);
    const message = buildMemoryMessage(groups);
    await sendFormattedMessage(ctx, message);
  });

  return handler;
}
