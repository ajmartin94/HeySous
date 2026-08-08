import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { createTestSqlite } from "../helpers/test-db.js";
import { seedHousehold } from "../helpers/seed.js";
import { buildInitData, testUser } from "../helpers/init-data.js";
import { createTestApp, startServer, type RunningServer } from "../helpers/test-app.js";
import { saveMemory } from "../../../src/memory/repository.js";

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

describe("memory routes", () => {
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

  it("GET /api/memories returns memories grouped by category", async () => {
    saveMemory(sqlite, HOUSEHOLD_ID, "Allergic to peanuts", "dietary");
    saveMemory(sqlite, HOUSEHOLD_ID, "Loves spicy food", "taste");

    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/memories`, {
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.categories)).toBe(true);
    const dietary = body.categories.find((c: { name: string }) => c.name === "dietary");
    expect(dietary.memories).toEqual([
      expect.objectContaining({ content: "Allergic to peanuts" }),
    ]);
  });

  it("DELETE /api/memories/:id deletes an existing memory", async () => {
    const created = saveMemory(sqlite, HOUSEHOLD_ID, "Loves spicy food", "taste");

    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/memories/${created.id}`, {
      method: "DELETE",
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });

    const row = sqlite.prepare("SELECT id FROM memories WHERE id = ?").get(created.id);
    expect(row).toBeUndefined();
  });

  it("DELETE /api/memories/:id returns 404 for a memory owned by another household", async () => {
    const otherHouseholdId = "household-other";
    const created = saveMemory(sqlite, otherHouseholdId, "Not yours", "general");

    const initData = buildInitData(TEST_BOT_TOKEN, testUser(Number(TELEGRAM_ID)));
    const res = await fetch(`${server.baseUrl}/api/memories/${created.id}`, {
      method: "DELETE",
      headers: { "x-init-data": initData },
    });

    expect(res.status).toBe(404);

    const row = sqlite.prepare("SELECT id FROM memories WHERE id = ?").get(created.id);
    expect(row).toBeDefined();
  });
});
