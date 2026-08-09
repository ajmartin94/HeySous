/**
 * Daily Cost Budget Guard
 *
 * Checks whether a household has exceeded its daily spend, using a midnight
 * boundary in the configured timezone.
 *
 * Budgets are in dollars, not tokens. Summing input + output + cache_creation +
 * cache_read treats token classes that differ ~20x in price as equivalent, so
 * the same token ceiling authorised anywhere from $0.80 to $40 per household
 * per day depending on cache mix -- and heavily-cached conversations, the cheap
 * case, exhausted it fastest. Spend is also model-independent, so this survives
 * a model switch without retuning.
 *
 * Uses raw SQLite prepared statement (same pattern as preferences.ts, fts.ts).
 */

import type BetterSqlite3 from "better-sqlite3";

export interface BudgetCheckResult {
  allowed: boolean;
  /** Dollars spent by this household since midnight in the given timezone. */
  costUsed: number;
  /** The daily ceiling in dollars. */
  budgetUsd: number;
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
 * Check whether a household is within its daily spend budget.
 *
 * Accuracy depends on MODEL_PRICING carrying an entry for the model in use --
 * an unpriced model falls back to the most expensive rates, which over-reports
 * (and so blocks early) rather than letting spend run unmeasured.
 *
 * @param sqlite - Raw better-sqlite3 database instance
 * @param householdId - Household ID for per-household isolation
 * @param budgetUsd - Maximum dollars allowed per day
 * @param timezone - IANA timezone for midnight boundary calculation
 * @returns BudgetCheckResult with allowed flag and spend details
 */
export function checkDailyCostBudget(
  sqlite: BetterSqlite3.Database,
  householdId: string,
  budgetUsd: number,
  timezone: string,
): BudgetCheckResult {
  const midnightEpoch = getMidnightEpochSeconds(timezone);

  const row = sqlite
    .prepare(
      `
      SELECT COALESCE(SUM(estimated_cost), 0) AS total_cost
      FROM token_usage
      WHERE household_id = ?
        AND created_at >= ?
      `,
    )
    .get(householdId, midnightEpoch) as { total_cost: number } | undefined;

  const costUsed = row?.total_cost ?? 0;

  return {
    allowed: costUsed < budgetUsd,
    costUsed,
    budgetUsd,
  };
}
