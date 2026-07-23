import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Request, Response } from "express";
import type Database from "better-sqlite3";
import { createInitDataValidator } from "../../src/mini-app/auth-middleware.js";
import { createTestSqlite } from "./helpers/test-db.js";
import { seedHousehold } from "./helpers/seed.js";
import { buildInitData, tamperHash } from "./helpers/init-data.js";

// See tests/mini-app/helpers/constants.ts -- keep botToken in sync with
// TEST_BOT_TOKEN there (vi.mock factories can't reference outer variables).
vi.mock("../../src/config.js", () => ({
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
const REGISTERED_TELEGRAM_ID = "1001";
const REGISTERED_HOUSEHOLD_ID = "household-1001";

/** Minimal mock of Express's Response, enough for the middleware under test. */
function makeMockRes() {
  const res = {
    locals: {} as Record<string, unknown>,
    statusCode: undefined as number | undefined,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  return res;
}

function makeMockReq(initData?: string) {
  return {
    headers: initData ? { "x-init-data": initData } : {},
  } as unknown as Request;
}

describe("createInitDataValidator", () => {
  let sqlite: InstanceType<typeof Database>;
  let validate: ReturnType<typeof createInitDataValidator>;

  beforeEach(() => {
    sqlite = createTestSqlite();
    seedHousehold(sqlite, {
      householdId: REGISTERED_HOUSEHOLD_ID,
      telegramId: REGISTERED_TELEGRAM_ID,
      displayName: "Registered User",
    });
    validate = createInitDataValidator(sqlite);
  });

  afterEach(() => {
    sqlite.close();
  });

  it("passes valid initData for a registered user and sets res.locals scoping", () => {
    const initData = buildInitData(TEST_BOT_TOKEN, { id: 1001, first_name: "Reg" });
    const req = makeMockReq(initData);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeUndefined();
    expect(res.locals.householdId).toBe(REGISTERED_HOUSEHOLD_ID);
    expect(res.locals.chatId).toBe(REGISTERED_TELEGRAM_ID);
  });

  it("rejects initData with a tampered hash", () => {
    const initData = buildInitData(TEST_BOT_TOKEN, { id: 1001, first_name: "Reg" });
    const req = makeMockReq(tamperHash(initData));
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid initData" });
  });

  it("rejects expired initData (older than expiresIn=3600s)", () => {
    const authDate = new Date(Date.now() - 2 * 3600 * 1000); // 2 hours ago
    const initData = buildInitData(TEST_BOT_TOKEN, { id: 1001, first_name: "Reg" }, { authDate });
    const req = makeMockReq(initData);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid initData" });
  });

  it("rejects a missing initData header", () => {
    const req = makeMockReq(undefined);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Missing initData" });
  });

  it("rejects malformed initData that isn't a valid signed query string", () => {
    const req = makeMockReq("this-is-not-valid-init-data");
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid initData" });
  });

  it("rejects validly-signed initData for a user with no `user` field at all", () => {
    // sign() allows omitting `user`; middleware should reject with a
    // distinct message since parsed.user is undefined.
    const initData = buildInitData(TEST_BOT_TOKEN);
    const req = makeMockReq(initData);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "No user in initData" });
  });

  it("rejects validly-signed initData for a user not registered in the DB", () => {
    const initData = buildInitData(TEST_BOT_TOKEN, { id: 424242, first_name: "Stranger" });
    const req = makeMockReq(initData);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "User not registered" });
  });

  it("rejects initData signed with a different bot token", () => {
    const initData = buildInitData("999999:WRONG-TOKEN", { id: 1001, first_name: "Reg" });
    const req = makeMockReq(initData);
    const res = makeMockRes();
    const next = vi.fn();

    validate(req, res as unknown as Response, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Invalid initData" });
  });
});
