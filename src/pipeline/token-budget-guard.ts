/**
 * Daily Token Budget Guard
 *
 * Checks whether a household has exceeded its daily token budget.
 * Queries the token_usage table for today's total consumption,
 * using a midnight boundary in the configured timezone.
 *
 * Uses raw SQLite prepared statement (same pattern as preferences.ts, fts.ts).
 */

import type BetterSqlite3 from "better-sqlite3";

export interface BudgetCheckResult {
  allowed: boolean;
  tokensUsed: number;
  budgetTokens: number;
}

/**
 * Get the Unix timestamp (in seconds) for midnight today in the given timezone.
 *
 * Uses Intl.DateTimeFormat to resolve today's date in the timezone,
 * then constructs a midnight timestamp from that date string.
 */
function getMidnightEpochSeconds(timezone: string): number {
  // Get today's date string in the timezone (YYYY-MM-DD format via en-CA locale)
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const todayStr = formatter.format(new Date());

  // Construct a Date for midnight in the timezone using the offset approach
  // First, get a reference point at midnight UTC for today
  const refDate = new Date(`${todayStr}T00:00:00Z`);

  // Use Intl to find what local time corresponds to that UTC reference
  const detailFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = detailFormatter.formatToParts(refDate);
  const getPart = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAtRef = Date.UTC(
    getPart("year"),
    getPart("month") - 1,
    getPart("day"),
    getPart("hour") === 24 ? 0 : getPart("hour"),
    getPart("minute"),
    getPart("second"),
  );

  // offsetMs = how far ahead local time is from UTC
  const offsetMs = localAtRef - refDate.getTime();

  // Midnight local = midnight UTC minus the offset
  const midnightUtcMs = refDate.getTime() - offsetMs;

  return Math.floor(midnightUtcMs / 1000);
}

/**
 * Check whether a household is within its daily token budget.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param householdId - Household ID for per-household isolation
 * @param budgetTokens - Maximum tokens allowed per day
 * @param timezone - IANA timezone for midnight boundary calculation
 * @returns BudgetCheckResult with allowed flag and usage details
 */
export function checkDailyTokenBudget(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  budgetTokens: number,
  timezone: string,
): BudgetCheckResult {
  const midnightEpoch = getMidnightEpochSeconds(timezone);

  const row = sqlite
    .prepare(
      `
      SELECT COALESCE(SUM(
        input_tokens + output_tokens + cache_creation_tokens + cache_read_tokens
      ), 0) AS total_tokens
      FROM token_usage
      WHERE household_id = ?
        AND created_at >= ?
      `,
    )
    .get(householdId, midnightEpoch) as { total_tokens: number } | undefined;

  const tokensUsed = row?.total_tokens ?? 0;

  return {
    allowed: tokensUsed < budgetTokens,
    tokensUsed,
    budgetTokens,
  };
}
