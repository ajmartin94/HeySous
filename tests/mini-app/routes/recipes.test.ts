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

const HOUSEHOLD_A = "household-A";
const USER_A_ID = "1111";
const HOUSEHOLD_B = "household-B";
const USER_B_ID = "2222";

/** Insert a recipe (knowledge_item tagged 'recipe') directly for a household. */
function seedRecipe(
  sqlite: InstanceType<typeof Database>,
  opts: { householdId: string; title: string },
): number {
  const result = sqlite
    .prepare(
      `INSERT INTO knowledge_items (household_id, title, summary, content)
       VALUES (?, ?, ?, ?)`,
    )
    .run(opts.householdId, opts.title, "summary", "Ingredients:\n- thing\nSteps:\n- do it");
  const id = Number(result.lastInsertRowid);
  sqlite
    .prepare(`INSERT INTO knowledge_tags (knowledge_item_id, tag) VALUES (?, 'recipe')`)
    .run(id);
  return id;
}

describe("recipe routes -- household scoping", () => {
  let sqlite: InstanceType<typeof Database>;
  let server: RunningServer;
  let recipeAId: number;

  beforeEach(async () => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, { householdId: HOUSEHOLD_A, telegramId: USER_A_ID, displayName: "Alice" });
    seedHousehold(sqlite, { householdId: HOUSEHOLD_B, telegramId: USER_B_ID, displayName: "Bob" });
    recipeAId = seedRecipe(sqlite, { householdId: HOUSEHOLD_A, title: "Household A Secret Stew" });
    server = await startServer(createTestApp(sqlite));
  });

  afterEach(async () => {
    await server.close();
    sqlite.close();
  });

  it("GET /api/recipes never returns another household's recipes", async () => {
    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const res = await fetch(`${server.baseUrl}/api/recipes`, {
      headers: { "x-init-data": initDataB },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes).toEqual([]);
  });

  it("GET /api/recipes returns the recipe to the owning household", async () => {
    const initDataA = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_A_ID)));
    const res = await fetch(`${server.baseUrl}/api/recipes`, {
      headers: { "x-init-data": initDataA },
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recipes).toHaveLength(1);
    expect(body.recipes[0].title).toBe("Household A Secret Stew");
  });

  it("GET /api/recipes/:id returns 404 for a recipe owned by a different household", async () => {
    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const res = await fetch(`${server.baseUrl}/api/recipes/${recipeAId}`, {
      headers: { "x-init-data": initDataB },
    });

    expect(res.status).toBe(404);
  });

  it("DELETE /api/recipes/:id returns 404 and does not delete a recipe owned by a different household", async () => {
    const initDataB = buildInitData(TEST_BOT_TOKEN, testUser(Number(USER_B_ID)));
    const res = await fetch(`${server.baseUrl}/api/recipes/${recipeAId}`, {
      method: "DELETE",
      headers: { "x-init-data": initDataB },
    });

    expect(res.status).toBe(404);

    const stillThere = sqlite
      .prepare("SELECT id FROM knowledge_items WHERE id = ?")
      .get(recipeAId);
    expect(stillThere).toBeDefined();
  });
});
