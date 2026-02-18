import type { SavedPlan } from "./repository.js";
import type { CookingHistoryEntry } from "./history.js";
import { DAY_NAMES } from "./date-utils.js";

/**
 * Build meal planning context for system prompt injection.
 * Follows the same pattern as buildPreferenceContext in system-prompt.ts.
 *
 * @param plans - Active meal plans (current and/or next week)
 * @param history - Recent cooking history entries
 * @returns Formatted context string, or empty string if no data
 */
export function buildPlanContext(
  plans: SavedPlan[],
  history: CookingHistoryEntry[],
): string {
  if (plans.length === 0 && history.length === 0) {
    return "";
  }

  const lines: string[] = [];
  lines.push("<meal_planning_context>");

  if (plans.length > 0) {
    lines.push("");
    lines.push("ACTIVE PLANS:");
    for (const plan of plans) {
      lines.push(`Week of ${plan.weekStartDate}:`);
      for (const entry of plan.entries) {
        const dayName = DAY_NAMES[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`;
        const idSuffix = entry.knowledgeItemId ? ` [recipe #${entry.knowledgeItemId}]` : "";
        lines.push(`- ${dayName}: ${entry.recipeName}${idSuffix}`);
      }
    }
  }

  if (history.length > 0) {
    lines.push("");
    lines.push("RECENT COOKING HISTORY (last 3 weeks):");
    for (const entry of history) {
      lines.push(`- ${entry.cookedDate}: ${entry.recipeName}`);
    }
  }

  lines.push("");
  lines.push("</meal_planning_context>");

  return lines.join("\n");
}
