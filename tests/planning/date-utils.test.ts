import { describe, it, expect, afterEach } from "vitest";
import {
  getWeekStartDate,
  addDays,
  formatDateRange,
  buildDateContext,
  DAY_NAMES,
} from "../../src/planning/date-utils.js";

/**
 * These tests exercise the date-only math helpers. They deliberately mutate
 * process.env.TZ to prove the functions are immune to the server's timezone:
 * the app derives "today" from the household timezone and passes an ISO
 * date-only string, so parsing must never depend on where the server runs.
 */

const ORIGINAL_TZ = process.env.TZ;

afterEach(() => {
  if (ORIGINAL_TZ === undefined) {
    delete process.env.TZ;
  } else {
    process.env.TZ = ORIGINAL_TZ;
  }
});

/** Timezones spanning the extremes plus DST-at-midnight zones. */
const EXTREME_ZONES = [
  "UTC",
  "Pacific/Kiritimati", // UTC+14
  "Pacific/Pago_Pago", // UTC-11
  "America/Sao_Paulo", // historically sprang forward at midnight
  "America/Santiago",
  "Asia/Kolkata", // UTC+5:30
];

describe("getWeekStartDate", () => {
  it("returns the Monday of the week for a mid-week date", () => {
    // 2026-04-22 is a Wednesday -> Monday is 2026-04-20
    expect(getWeekStartDate("2026-04-22")).toBe("2026-04-20");
  });

  it("returns the same date when the input is already a Monday", () => {
    expect(getWeekStartDate("2026-04-20")).toBe("2026-04-20");
  });

  it("returns the previous Monday for a Sunday", () => {
    // 2026-04-26 is a Sunday -> Monday is 2026-04-20
    expect(getWeekStartDate("2026-04-26")).toBe("2026-04-20");
  });

  it("crosses a month boundary correctly", () => {
    // 2026-03-01 is a Sunday -> Monday is 2026-02-23
    expect(getWeekStartDate("2026-03-01")).toBe("2026-02-23");
  });

  it("is immune to the server timezone (produces identical output everywhere)", () => {
    for (const tz of EXTREME_ZONES) {
      process.env.TZ = tz;
      expect(getWeekStartDate("2026-04-22")).toBe("2026-04-20");
      expect(getWeekStartDate("2026-04-26")).toBe("2026-04-20");
      expect(getWeekStartDate("2026-03-01")).toBe("2026-02-23");
    }
  });
});

describe("addDays", () => {
  it("adds days within a month", () => {
    expect(addDays("2026-04-20", 5)).toBe("2026-04-25");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-04-28", 5)).toBe("2026-05-03");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
  });

  it("subtracts days with a negative delta", () => {
    expect(addDays("2026-04-20", -1)).toBe("2026-04-19");
  });

  it("adds a full week", () => {
    expect(addDays("2026-04-20", 7)).toBe("2026-04-27");
  });

  it("is immune to the server timezone (produces identical output everywhere)", () => {
    for (const tz of EXTREME_ZONES) {
      process.env.TZ = tz;
      expect(addDays("2026-04-20", 5)).toBe("2026-04-25");
      expect(addDays("2026-04-28", 5)).toBe("2026-05-03");
      expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
      // The reported crash week + Saturday (day index 5)
      expect(addDays("2026-04-20", 5)).toBe("2026-04-25");
    }
  });
});

describe("formatDateRange", () => {
  it("omits the repeated month when the whole week is in one month", () => {
    // Mon 2026-04-20 .. Sun 2026-04-26 -> both April
    expect(formatDateRange("2026-04-20")).toBe("Apr 20 - 26");
  });

  it("shows both months when the week spans two months", () => {
    // Mon 2026-04-27 .. Sun 2026-05-03
    expect(formatDateRange("2026-04-27")).toBe("Apr 27 - May 3");
  });

  it("shows both months when the week spans two years", () => {
    // Mon 2026-12-28 .. Sun 2027-01-03
    expect(formatDateRange("2026-12-28")).toBe("Dec 28 - Jan 3");
  });

  it("is immune to the server timezone", () => {
    for (const tz of EXTREME_ZONES) {
      process.env.TZ = tz;
      expect(formatDateRange("2026-04-20")).toBe("Apr 20 - 26");
      expect(formatDateRange("2026-04-27")).toBe("Apr 27 - May 3");
    }
  });
});

describe("DAY_NAMES", () => {
  it("indexes Monday=0 through Sunday=6", () => {
    expect(DAY_NAMES[0]).toBe("Monday");
    expect(DAY_NAMES[5]).toBe("Saturday");
    expect(DAY_NAMES[6]).toBe("Sunday");
  });
});

describe("buildDateContext", () => {
  /**
   * Bekah asked for a dinner "next week" on Friday 2026-07-24 and Sous
   * answered "Tuesday, August 4th" -- a full week late. The model was doing
   * week arithmetic itself; this block hands it the answer instead.
   */
  it("spells out this week and next week so 'next week' needs no arithmetic", () => {
    const ctx = buildDateContext("2026-07-24"); // a Friday

    expect(ctx).toContain("Today is Friday, July 24, 2026 (2026-07-24)");
    expect(ctx).toContain("This week (Monday 2026-07-20 to Sunday 2026-07-26)");
    expect(ctx).toContain("Next week (Monday 2026-07-27 to Sunday 2026-08-02)");
    // The date Sous got wrong: next week's Tuesday is the 28th, not Aug 4.
    expect(ctx).toContain("Tuesday 2026-07-28");
    expect(ctx).not.toContain("2026-08-04");
  });

  it("treats Sunday as the last day of the current week, not the first", () => {
    const ctx = buildDateContext("2026-07-26"); // the Sunday of that same week
    expect(ctx).toContain("This week (Monday 2026-07-20 to Sunday 2026-07-26)");
    expect(ctx).toContain("Next week (Monday 2026-07-27 to Sunday 2026-08-02)");
  });

  it("handles a week that spans a month boundary", () => {
    const ctx = buildDateContext("2026-07-30"); // Thursday
    expect(ctx).toContain("This week (Monday 2026-07-27 to Sunday 2026-08-02)");
    expect(ctx).toContain("Next week (Monday 2026-08-03 to Sunday 2026-08-09)");
  });

  it("is immune to the server timezone", () => {
    for (const tz of EXTREME_ZONES) {
      process.env.TZ = tz;
      expect(buildDateContext("2026-07-24")).toContain(
        "This week (Monday 2026-07-20 to Sunday 2026-07-26)",
      );
    }
  });
});
