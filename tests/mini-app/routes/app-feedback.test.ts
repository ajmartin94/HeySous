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

describe("POST /api/feedback", () => {
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

  it("saves feedback text and returns ok", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "x-init-data": initData, "content-type": "application/json" },
      body: JSON.stringify({ text: "The app is great!" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const row = sqlite
      .prepare("SELECT household_id, user_id, text, source FROM app_feedback")
      .get() as { household_id: string; user_id: string; text: string; source: string };
    expect(row).toEqual({
      household_id: HOUSEHOLD_ID,
      user_id: TELEGRAM_ID,
      text: "The app is great!",
      source: "mini-app",
    });
  });

  it("rejects empty feedback text with 400", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/feedback`, {
      method: "POST",
      headers: { "x-init-data": initData, "content-type": "application/json" },
      body: JSON.stringify({ text: "   " }),
    });

    expect(res.status).toBe(400);
  });
});
