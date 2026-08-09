import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { createTestSqlite } from "../helpers/test-db.js";
import { seedHousehold } from "../helpers/seed.js";
import { buildInitData, testUser } from "../helpers/init-data.js";
import { createTestApp, startServer, type RunningServer } from "../helpers/test-app.js";

// Keep in sync with tests/mini-app/helpers/constants.ts.
vi.mock("../../../src/config.js", () => ({
  config: {
    botToken: "123456:TEST-BOT-TOKEN-abcdefghijklmnop",
    adminUserIds: [],
    adminUserId: "",
    sessionTimezone: "America/New_York",
    dailyCostBudgetUsd: 5,
    isDev: false,
    logLevel: "silent",
    miniAppUrl: "",
  },
}));

const TEST_BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdefghijklmnop";
const HOUSEHOLD_ID = "household-1";
const TELEGRAM_ID = "1001";

/** Monday-based week start date matching the route handler's own calculation. */
function currentWeekStartDate(): string {
  const now = new Date();
  const jsDay = now.getDay();
  const mondayOffset = (jsDay + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset);
  const yyyy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

describe("GET /api/meal-plan", () => {
  let sqlite: InstanceType<typeof Database>;
  let server: RunningServer;

  beforeEach(async () => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, { householdId: HOUSEHOLD_ID, telegramId: TELEGRAM_ID });
    server = await startServer(createTestApp(sqlite));
  });

  afterEach(async () => {
    await server.close();
    sqlite.close();
  });

  it("returns an empty plan for a household with no meal plan entries", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/meal-plan`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.weekStartDate).toBe(currentWeekStartDate());
    expect(body.entries).toEqual([]);
  });

  it("returns entries with hasRecipe detection for the current week", async () => {
    const weekStartDate = currentWeekStartDate();
    const planResult = sqlite
      .prepare(`INSERT INTO meal_plans (household_id, week_start_date) VALUES (?, ?)`)
      .run(HOUSEHOLD_ID, weekStartDate);
    const planId = Number(planResult.lastInsertRowid);

    sqlite
      .prepare(
        `INSERT INTO meal_plan_entries (plan_id, day_of_week, meal_type, recipe_name)
         VALUES (?, 1, 'dinner', 'Tacos')`,
      )
      .run(planId);

    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/meal-plan`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]).toEqual(
      expect.objectContaining({
        recipeName: "Tacos",
        mealType: "dinner",
        hasRecipe: false,
      }),
    );
  });
});
