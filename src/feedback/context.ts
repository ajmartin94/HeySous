/**
 * Feedback Context Builder
 *
 * Builds a lightweight feedback context summary for the system prompt.
 * Shows recent feedback (last 14 days) so Claude can reference past
 * feedback when making suggestions.
 *
 * Same pattern as reminders/context.ts and grocery/context.ts.
 */

import type BetterSqlite3 from "better-sqlite3";
import type { Clock } from "../clock.js";

/** Raw row shape from the feedback context query. */
interface FeedbackContextRow {
  sentiment: string;
  notes: string | null;
  responded_at: number;
  context_json: string;
}

/**
 * Build feedback context for system prompt injection.
 *
 * Queries recent responded feedback check-ins (last 14 days) and formats
 * them as a lightweight XML block for Claude to reference.
 *
 * @param sqlite - The SQLite database instance
 * @param householdId - The household ID to look up feedback for
 * @param clock - Clock instance for time calculations
 * @returns Formatted context string, or empty string if no recent feedback
 */
export function buildFeedbackContext(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  clock: Clock,
): string {
  const fourteenDaysAgo = Math.floor(clock.now() / 1000) - 14 * 86400;

  const rows = sqlite
    .prepare(
      `SELECT fc.sentiment, fc.notes, fc.responded_at, r.context_json
       FROM feedback_checkins fc
       JOIN reminders r ON r.id = fc.reminder_id
       WHERE fc.household_id = ? AND fc.status = 'responded' AND fc.responded_at > ?
       ORDER BY fc.responded_at DESC
       LIMIT 20`,
    )
    .all(householdId, fourteenDaysAgo) as FeedbackContextRow[];

  if (rows.length === 0) return "";

  const lines = rows.map((row) => {
    // Extract recipe names from reminder context_json
    let recipeNames = "Unknown recipe";
    try {
      const context = JSON.parse(row.context_json) as {
        date?: string;
        meals?: Array<{ recipeName: string }>;
      };
      if (context.meals && context.meals.length > 0) {
        recipeNames = context.meals.map((m) => m.recipeName).join(", ");
      }
    } catch {
      // Use default
    }

    const date = new Date(row.responded_at * 1000)
      .toISOString()
      .split("T")[0];

    const notesStr = row.notes ? ` - "${row.notes}"` : "";

    return `- ${recipeNames} (${date}): ${row.sentiment}${notesStr}`;
  });

  return `
<feedback_context>
Recent feedback (last 2 weeks):
${lines.join("\n")}
</feedback_context>`;
}
