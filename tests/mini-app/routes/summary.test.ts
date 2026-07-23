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
    dailyTokenBudget: 500000,
    isDev: false,
    logLevel: "silent",
    miniAppUrl: "",
  },
}));

const TEST_BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdefghijklmnop";
const HOUSEHOLD_ID = "household-1";
const TELEGRAM_ID = "1001";

describe("GET /api/summary", () => {
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

  it("returns zeroed counts for a household with no data", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/summary`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      grocery: { uncheckedCount: 0 },
      recipes: { count: 0 },
      plans: { mealCount: 0 },
    });
  });
});
