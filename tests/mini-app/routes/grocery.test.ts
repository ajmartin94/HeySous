import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type Database from "better-sqlite3";
import { createTestSqlite } from "../helpers/test-db.js";
import { seedHousehold } from "../helpers/seed.js";
import { buildInitData, testUser } from "../helpers/init-data.js";
import { createTestApp, startServer, type RunningServer } from "../helpers/test-app.js";
import { createGroceryRepository } from "../../../src/grocery/repository.js";

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

const HOUSEHOLD_A = "household-A";
const USER_A_ID = "1111";
const HOUSEHOLD_B = "household-B";
const USER_B_ID = "2222";

describe("grocery routes -- household scoping", () => {
  let sqlite: InstanceType<typeof Database>;
  let server: RunningServer;

  beforeEach(async () => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, { householdId: HOUSEHOLD_A, telegramId: USER_A_ID, displayName: "Alice" });
    seedHousehold(sqlite, { householdId: HOUSEHOLD_B, telegramId: USER_B_ID, displayName: "Bob" });
    server = await startServer(createTestApp(sqlite));
  });

  afterEach(async () => {
    await server.close();
    sqlite.close();
  });

  async function addItemAsA(name: string) {
    // The mini-app has no endpoint to create a grocery list (that happens
    // via the bot flow when a plan is made) -- seed one directly via the
    // repository, same as tests/feedback and other route tests seed data.
    createGroceryRepository(sqlite).createList(HOUSEHOLD_A);

    const initDataA = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_A_ID)));
    const res = await fetch(`${server.baseUrl}/api/grocery/add`, {
      method: "POST",
      headers: { "x-init-data": initDataA, "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    return body.items[0].id as number;
  }

  it("GET /api/grocery never returns another household's list", async () => {
    await addItemAsA("Household A's secret ingredient");

    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const res = await fetch(`${server.baseUrl}/api/grocery`, {
      headers: { "x-init-data": initDataB },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toEqual([]);
  });

  it("GET /api/grocery returns the list to the owning household", async () => {
    await addItemAsA("Household A's secret ingredient");

    const initDataA = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_A_ID)));
    const res = await fetch(`${server.baseUrl}/api/grocery`, {
      headers: { "x-init-data": initDataA },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].name).toBe("Household A's secret ingredient");
  });

  it("POST /api/grocery/complete for household B does not complete household A's list", async () => {
    await addItemAsA("Household A's secret ingredient");

    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const completeRes = await fetch(`${server.baseUrl}/api/grocery/complete`, {
      method: "POST",
      headers: { "x-init-data": initDataB },
    });
    expect(completeRes.status).toBe(200);

    // Household A's list should still be active and visible to household A.
    const initDataA = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_A_ID)));
    const listRes = await fetch(`${server.baseUrl}/api/grocery`, {
      headers: { "x-init-data": initDataA },
    });
    const body = await listRes.json();
    expect(body.items).toHaveLength(1);
  });

  // Regression test for a fixed IDOR: POST /api/grocery/toggle
  // (src/mini-app/routes/grocery.ts toggleItem) used to take `itemId` from
  // the request body and call repo.toggleItem(itemId) with NO
  // household-ownership check at all -- unlike getList/addItem/completeList,
  // which all scope through res.locals.householdId. That let any
  // authenticated user (from ANY household) toggle any grocery item in the
  // whole database by guessing/enumerating numeric item ids. The handler now
  // verifies the item belongs to the caller's household via
  // repo.itemBelongsToHousehold before toggling.
  it("POST /api/grocery/toggle rejects household B toggling household A's item", async () => {
    const itemId = await addItemAsA("Household A's secret ingredient");

    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const toggleRes = await fetch(`${server.baseUrl}/api/grocery/toggle`, {
      method: "POST",
      headers: { "x-init-data": initDataB, "content-type": "application/json" },
      body: JSON.stringify({ itemId }),
    });

    // Fixed behavior: cross-household toggle is rejected and the item is
    // left untouched.
    expect(toggleRes.status).toBe(404);

    const row = sqlite
      .prepare("SELECT checked FROM grocery_list_items WHERE id = ?")
      .get(itemId) as { checked: number };
    expect(row.checked).toBe(0);
  });
});
