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

describe("settings routes", () => {
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

  it("GET /api/settings returns defaults when no settings row exists yet", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/settings`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual(
      expect.objectContaining({
        timezone: "America/New_York",
        morning_enabled: true,
        prep_alerts_enabled: true,
        muted_until: null,
      }),
    );
  });

  it("PUT /api/settings updates fields and returns the updated row", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "x-init-data": initData, "content-type": "application/json" },
      body: JSON.stringify({ timezone: "Europe/London", morning_enabled: false }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.timezone).toBe("Europe/London");
    expect(body.morning_enabled).toBe(false);

    // Persisted for this household.
    const row = sqlite
      .prepare("SELECT timezone, morning_enabled FROM application_settings WHERE household_id = ?")
      .get(HOUSEHOLD_ID) as { timezone: string; morning_enabled: number };
    expect(row.timezone).toBe("Europe/London");
    expect(row.morning_enabled).toBe(0);
  });

  it("PUT /api/settings rejects a body with no updatable fields", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "x-init-data": initData, "content-type": "application/json" },
      body: JSON.stringify({ not_a_real_field: "x" }),
    });

    expect(res.status).toBe(400);
  });
});
