/**
 * Clock Abstraction
 *
 * Provides a seam for controlling time in tests and UAT.
 * Production code uses createClock() (delegates to Date).
 * Tests/UAT use createTestClock() with set/advance controls.
 *
 * Also houses shared time utilities (localTimeToUtc, getTodayInTimezone)
 * previously duplicated in reminders/generator.ts and feedback/generator.ts.
 */

export interface Clock {
  now(): number;
  date(): Date;
}

/**
 * Production clock — delegates to real Date.
 */
export function createClock(): Clock {
  return {
    now: () => Date.now(),
    date: () => new Date(),
  };
}

export type TestClock = Clock & {
  set(time: Date): void;
  advance(ms: number): void;
  reset(): void;
};

/**
 * Controllable clock for tests and UAT.
 * Starts at real time (or a provided initial time) and can be moved freely.
 */
export function createTestClock(initial?: Date): TestClock {
  let currentTime = initial?.getTime() ?? Date.now();
  let useReal = false;

  return {
    now: () => (useReal ? Date.now() : currentTime),
    date: () => (useReal ? new Date() : new Date(currentTime)),
    set: (time: Date) => {
      currentTime = time.getTime();
      useReal = false;
    },
    advance: (ms: number) => {
      if (useReal) currentTime = Date.now();
      currentTime += ms;
      useReal = false;
    },
    reset: () => {
      useReal = true;
    },
  };
}

// ---------------------------------------------------------------------------
// Shared time utilities
// ---------------------------------------------------------------------------

/**
 * Convert a local time (date + "HH:MM" in a timezone) to a UTC Date.
 *
 * Uses Intl.DateTimeFormat to resolve the UTC offset for the given timezone
 * on the given date, then applies that offset to produce UTC.
 */
export function localTimeToUtc(
  dateStr: string,
  time: string,
  timezone: string,
): Date {
  const [hours, minutes] = time.split(":").map(Number);

  const refDate = new Date(`${dateStr}T${time}:00Z`);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(refDate);
  const getPart = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  const localAtRef = new Date(
    Date.UTC(
      getPart("year"),
      getPart("month") - 1,
      getPart("day"),
      getPart("hour") === 24 ? 0 : getPart("hour"),
      getPart("minute"),
      getPart("second"),
    ),
  );

  const offsetMs = localAtRef.getTime() - refDate.getTime();

  const localTarget = new Date(
    `${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00Z`,
  );

  return new Date(localTarget.getTime() - offsetMs);
}

/**
 * Get today's date as "YYYY-MM-DD" in the user's timezone.
 */
export function getTodayInTimezone(timezone: string, clock: Clock): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(clock.date());
}

/**
 * Format a Date as "YYYY-MM-DD" ISO date string.
 */
export function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
