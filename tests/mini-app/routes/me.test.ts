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
const MEMBER_ID = "1001";
const ADMIN_MEMBER_ID = "1002";

describe("GET /api/me", () => {
  let sqlite: InstanceType<typeof Database>;
  let server: RunningServer;

  beforeEach(async () => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, { householdId: HOUSEHOLD_ID, telegramId: MEMBER_ID, displayName: "Member", role: "member" });
    seedHousehold(sqlite, { householdId: HOUSEHOLD_ID, telegramId: ADMIN_MEMBER_ID, displayName: "Boss", role: "admin" });
    server = await startServer(createTestApp(sqlite));
  });

  afterEach(async () => {
    await server.close();
    sqlite.close();
  });

  it("returns the authenticated user's role (member)", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(MEMBER_ID)));
    const res = await fetch(`${server.baseUrl}/api/me`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ role: "member" });
  });

  it("returns the authenticated user's role (admin)", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(ADMIN_MEMBER_ID)));
    const res = await fetch(`${server.baseUrl}/api/me`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ role: "admin" });
  });
});
