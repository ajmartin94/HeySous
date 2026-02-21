import { describe, it, expect, vi, afterEach } from "vitest";
import {
  pickRandom,
  getErrorMessage,
  getTimeoutMessage,
  getAccessGateMessage,
  getWelcomeBackMessage,
  getInvalidTokenMessage,
  getNoTokenMessage,
  getAdminJoinNotification,
  getNoGroceryListMessage,
  getInviteLinkMessage,
  getFeedbackEmptyMessage,
  getFeedbackThanksMessage,
  getCheckinMessageSingle,
  getCheckinMessageMultiple,
  getCheckinMessageGeneric,
  getReminderFallbackMorning,
  getReminderFallbackPrep,
  getReminderFallbackCooking,
  getReminderFallbackCheckin,
  getReminderFallbackGeneric,
} from "../../src/bot/messages.js";

describe("pickRandom", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns an element from the array", () => {
    const items = ["a", "b", "c"];
    const result = pickRandom(items);
    expect(items).toContain(result);
  });

  it("returns first element when Math.random returns 0", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(pickRandom(["first", "second", "third"])).toBe("first");
  });

  it("returns last element when Math.random returns 0.99", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    expect(pickRandom(["first", "second", "third"])).toBe("third");
  });
});

describe("message functions return non-empty strings", () => {
  it("getErrorMessage", () => {
    expect(getErrorMessage().length).toBeGreaterThan(0);
  });

  it("getTimeoutMessage", () => {
    expect(getTimeoutMessage().length).toBeGreaterThan(0);
  });

  it("getAccessGateMessage", () => {
    expect(getAccessGateMessage().length).toBeGreaterThan(0);
  });

  it("getWelcomeBackMessage", () => {
    expect(getWelcomeBackMessage().length).toBeGreaterThan(0);
  });

  it("getInvalidTokenMessage", () => {
    expect(getInvalidTokenMessage().length).toBeGreaterThan(0);
  });

  it("getNoTokenMessage", () => {
    expect(getNoTokenMessage().length).toBeGreaterThan(0);
  });

  it("getNoGroceryListMessage", () => {
    expect(getNoGroceryListMessage().length).toBeGreaterThan(0);
  });

  it("getFeedbackEmptyMessage", () => {
    expect(getFeedbackEmptyMessage().length).toBeGreaterThan(0);
  });

  it("getFeedbackThanksMessage", () => {
    expect(getFeedbackThanksMessage().length).toBeGreaterThan(0);
  });

  it("getCheckinMessageGeneric", () => {
    expect(getCheckinMessageGeneric().length).toBeGreaterThan(0);
  });

  it("getReminderFallbackCheckin", () => {
    expect(getReminderFallbackCheckin().length).toBeGreaterThan(0);
  });

  it("getReminderFallbackGeneric", () => {
    expect(getReminderFallbackGeneric().length).toBeGreaterThan(0);
  });
});

describe("parameterized message functions", () => {
  it("getAdminJoinNotification includes display name", () => {
    const msg = getAdminJoinNotification("Alice");
    expect(msg).toContain("Alice");
  });

  it("getInviteLinkMessage includes URL", () => {
    const msg = getInviteLinkMessage("https://t.me/bot?start=abc123");
    expect(msg).toContain("https://t.me/bot?start=abc123");
  });

  it("getCheckinMessageSingle interpolates recipe name with HTML bold", () => {
    const msg = getCheckinMessageSingle("Chicken Parmesan");
    expect(msg).toContain("<b>Chicken Parmesan</b>");
  });

  it("getCheckinMessageMultiple formats two recipes with 'and'", () => {
    const msg = getCheckinMessageMultiple(["Chicken Parm", "Caesar Salad"]);
    expect(msg).toContain("<b>Chicken Parm</b>");
    expect(msg).toContain("<b>Caesar Salad</b>");
    expect(msg).toContain("and");
  });

  it("getCheckinMessageMultiple formats three recipes with comma and 'and'", () => {
    const msg = getCheckinMessageMultiple(["A", "B", "C"]);
    expect(msg).toContain("<b>A</b>");
    expect(msg).toContain(", and <b>C</b>");
  });

  it("getReminderFallbackMorning with noPlanNudge returns morning message", () => {
    const msg = getReminderFallbackMorning(undefined, true);
    expect(msg.toLowerCase()).toContain("morning");
  });

  it("getReminderFallbackMorning with meals includes recipe names", () => {
    const meals = [{ mealType: "dinner", recipeName: "Tacos" }];
    const msg = getReminderFallbackMorning(meals);
    expect(msg).toContain("Tacos");
  });

  it("getReminderFallbackMorning with empty meals returns generic morning", () => {
    const msg = getReminderFallbackMorning([]);
    expect(msg.toLowerCase()).toContain("morning");
  });

  it("getReminderFallbackPrep includes recipe name", () => {
    const msg = getReminderFallbackPrep("Beef Stew");
    expect(msg).toContain("Beef Stew");
  });

  it("getReminderFallbackCooking includes recipe name", () => {
    const msg = getReminderFallbackCooking("Pasta");
    expect(msg).toContain("Pasta");
  });
});
