import Database from "better-sqlite3";
import { beforeEach, describe, expect, it } from "vitest";
import { checkDailyCostBudget } from "../../src/pipeline/token-budget-guard.js";

const TZ = "America/New_York";
const HOUSEHOLD = "hh-1";

let sqlite: Database.Database;

/**
 * How far ahead of UTC the zone is at a given instant, in ms.
 *
 * Formats the instant in TZ and reinterprets those wall-clock fields as UTC.
 * Reading them back with `new Date(localeString)` instead would parse in the
 * *server's* zone, silently yielding 0 whenever the server already runs in TZ.
 */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const f = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(f("year"), f("month") - 1, f("day"), f("hour") % 24, f("minute"), f("second"));
  return asUtc - at.getTime();
}

/** Midnight today in TZ, as epoch seconds -- the guard's window start. */
function midnightEpoch(): number {
  const now = new Date();
  const offset = tzOffsetMs(now, TZ);
  // Shift into TZ wall-clock space, truncate to the day, shift back.
  const local = new Date(now.getTime() + offset);
  const localMidnight = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate(),
  );
  return Math.floor((localMidnight - offset) / 1000);
}

function insertUsage(cost: number, atEpoch: number, household = HOUSEHOLD): void {
  sqlite
    .prepare(
      `INSERT INTO token_usage
         (household_id, user_id, model, conversation_type, input_tokens,
          output_tokens, cache_creation_tokens, cache_read_tokens,
          estimated_cost, created_at)
       VALUES (?, 'u1', 'claude-sonnet-5', 'chat', 0, 0, 0, 0, ?, ?)`,
    )
    .run(household, cost, atEpoch);
}

beforeEach(() => {
  sqlite = new Database(":memory:");
  sqlite.exec(`
    CREATE TABLE token_usage (
      id INTEGER PRIMARY KEY,
      household_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      model TEXT NOT NULL,
      conversation_type TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
      cache_read_tokens INTEGER NOT NULL DEFAULT 0,
      estimated_cost REAL NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
});

describe("checkDailyCostBudget", () => {
  it("allows a household under its dollar budget", () => {
    insertUsage(1.25, midnightEpoch() + 3600);

    const result = checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ);

    expect(result.allowed).toBe(true);
    expect(result.costUsed).toBeCloseTo(1.25, 5);
    expect(result.budgetUsd).toBe(5);
  });

  it("blocks once spend reaches the budget", () => {
    insertUsage(3, midnightEpoch() + 3600);
    insertUsage(2, midnightEpoch() + 7200);

    expect(checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ).allowed).toBe(false);
  });

  it("counts only today's spend, not yesterday's", () => {
    insertUsage(99, midnightEpoch() - 3600); // just before midnight
    insertUsage(0.5, midnightEpoch() + 60);

    const result = checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ);

    expect(result.allowed).toBe(true);
    expect(result.costUsed).toBeCloseTo(0.5, 5);
  });

  it("isolates households from each other", () => {
    insertUsage(99, midnightEpoch() + 60, "other-household");

    const result = checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ);

    expect(result.allowed).toBe(true);
    expect(result.costUsed).toBe(0);
  });

  it("treats a household with no usage as fully unspent", () => {
    const result = checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ);

    expect(result.allowed).toBe(true);
    expect(result.costUsed).toBe(0);
  });

  /**
   * The old guard summed input + output + cache_creation + cache_read as if
   * they were interchangeable, but they differ ~20x in price. A conversation
   * dominated by cheap cache reads burned the budget fastest -- exactly the
   * traffic shape you want to encourage. Spend is the only unit that holds
   * steady across models and cache mixes.
   */
  it("is unaffected by token volume -- only dollars count", () => {
    sqlite
      .prepare(
        `INSERT INTO token_usage
           (household_id, user_id, model, conversation_type, input_tokens,
            output_tokens, cache_creation_tokens, cache_read_tokens,
            estimated_cost, created_at)
         VALUES (?, 'u1', 'claude-sonnet-5', 'chat', 0, 0, 0, 4000000, ?, ?)`,
      )
      .run(HOUSEHOLD, 0.8, midnightEpoch() + 60);

    // 4M cache-read tokens would have blown a 4M token budget outright, but
    // they only cost $0.80.
    const result = checkDailyCostBudget(sqlite, HOUSEHOLD, 5, TZ);

    expect(result.allowed).toBe(true);
    expect(result.costUsed).toBeCloseTo(0.8, 5);
  });
});
