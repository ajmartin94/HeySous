import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { createTestSqlite } from "../helpers/test-db.js";
import { seedHousehold } from "../helpers/seed.js";
import { buildInitData, testUser } from "../helpers/init-data.js";
import { createTestApp, startServer, type RunningServer } from "../helpers/test-app.js";

// Keep in sync with tests/mini-app/helpers/constants.ts (TEST_BOT_TOKEN / TEST_ADMIN_ID).
vi.mock("../../../src/config.js", () => ({
  config: {
    botToken: "123456:TEST-BOT-TOKEN-abcdefghijklmnop",
    adminUserIds: ["999"],
    adminUserId: "999",
    sessionTimezone: "America/New_York",
    dailyTokenBudget: 500000,
    isDev: false,
    logLevel: "silent",
    miniAppUrl: "",
  },
}));

const TEST_BOT_TOKEN = "123456:TEST-BOT-TOKEN-abcdefghijklmnop";
const ADMIN_TELEGRAM_ID = "999"; // seeded automatically by initializeUsers via config.adminUserId
const NON_ADMIN_TELEGRAM_ID = "2002";
const NON_ADMIN_HOUSEHOLD_ID = "household-2002";

describe("admin routes gating", () => {
  let sqlite: InstanceType<typeof Database>;
  let server: RunningServer;

  beforeEach(async () => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, {
      householdId: NON_ADMIN_HOUSEHOLD_ID,
      telegramId: NON_ADMIN_TELEGRAM_ID,
      displayName: "Regular Member",
    });
    server = await startServer(createTestApp(sqlite));
  });

  afterEach(async () => {
    await server.close();
    sqlite.close();
  });

  const adminEndpoints = [
    "/api/admin/activity",
    "/api/admin/stats",
    "/api/admin/costs",
    "/api/admin/feedback",
  ];

  for (const path of adminEndpoints) {
    it(`rejects a non-admin user on GET ${path}`, async () => {
      const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(NON_ADMIN_TELEGRAM_ID)));
      const res = await fetch(`${server.baseUrl}${path}`, {
        headers: { "x-init-data": initData },
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body).toEqual({ error: "Admin access required" });
    });

    it(`allows an admin user on GET ${path}`, async () => {
      const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(ADMIN_TELEGRAM_ID)));
      const res = await fetch(`${server.baseUrl}${path}`, {
        headers: { "x-init-data": initData },
      });

      expect(res.status).toBe(200);
    });
  }

  it("GET /api/admin/stats returns the expected shape for an admin", async () => {
    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(ADMIN_TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/admin/stats`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary).toEqual(
      expect.objectContaining({
        messagesCount: expect.any(Number),
        activeUsers: expect.any(Number),
        apiCalls: expect.any(Number),
        totalUsers: expect.any(Number),
        totalRecipes: expect.any(Number),
      }),
    );
    expect(Array.isArray(body.daily)).toBe(true);
  });
});
