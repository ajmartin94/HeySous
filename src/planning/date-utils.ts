/**
 * Day names indexed by dayOfWeek (0=Monday through 6=Sunday).
 */
export const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Parse an ISO "YYYY-MM-DD" date-only string into a Date anchored at UTC
 * midnight. This is deterministic and immune to the server's local timezone
 * -- unlike `new Date(dateStr + "T00:00:00")`, which parses in server-local
 * time and can land on an unexpected instant near DST transitions.
 *
 * @throws Error with a clear message if the string is not a valid date.
 */
function parseIsoDateUtc(dateStr: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) {
    throw new Error(
      `Invalid date "${dateStr}": expected ISO format YYYY-MM-DD`,
    );
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject values that overflowed (e.g. month 13, day 32) -- Date.UTC would
  // silently roll them over, producing a wrong date.
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    throw new Error(
      `Invalid date "${dateStr}": not a real calendar date`,
    );
  }
  return d;
}

/**
 * Get the Monday of the week containing the given date (or today).
 * Uses ISO week rules where Monday is the start of the week.
 *
 * All arithmetic is done in UTC so the result never depends on the server's
 * timezone. When no date is supplied, "today" is taken from the server's local
 * calendar date (backward-compatible) but then anchored to UTC for the math.
 *
 * @param dateStr - Optional ISO "YYYY-MM-DD" string representing today in the user's timezone.
 * @returns ISO date string "YYYY-MM-DD" for that Monday
 */
export function getWeekStartDate(dateStr?: string): string {
  let d: Date;
  if (dateStr) {
    d = parseIsoDateUtc(dateStr);
  } else {
    const now = new Date();
    d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  // JavaScript: Sunday=0, Monday=1, ..., Saturday=6
  // We want Monday=0, so adjust: (jsDay + 6) % 7 gives Mon=0..Sun=6
  const jsDay = d.getUTCDay();
  const daysSinceMonday = (jsDay + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return formatIsoDate(d);
}

/**
 * Format a date range for display in plan headers.
 * Takes a Monday ISO date and returns a compact range:
 *   - Same month: "Apr 20 - 26"
 *   - Spanning months (or years): "Apr 27 - May 3"
 *
 * @param weekStartDate - ISO date string "YYYY-MM-DD" for a Monday
 * @returns Formatted range string
 */
export function formatDateRange(weekStartDate: string): string {
  const start = parseIsoDateUtc(weekStartDate);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);

  const startMonth = MONTHS[start.getUTCMonth()];
  const endMonth = MONTHS[end.getUTCMonth()];

  if (startMonth === endMonth) {
    // Same month -- don't repeat the month name: "Apr 20 - 26"
    return `${startMonth} ${start.getUTCDate()} - ${end.getUTCDate()}`;
  }
  // Spanning months -- show both: "Apr 27 - May 3"
  return `${startMonth} ${start.getUTCDate()} - ${endMonth} ${end.getUTCDate()}`;
}

/**
 * Add N days to an ISO date string and return new ISO date string.
 * Arithmetic is done in UTC, so the result is immune to the server timezone.
 *
 * @param dateStr - ISO date string "YYYY-MM-DD"
 * @param days - Number of days to add (can be negative)
 * @returns ISO date string "YYYY-MM-DD"
 */
export function addDays(dateStr: string, days: number): string {
  const d = parseIsoDateUtc(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return formatIsoDate(d);
}

/**
 * Format a Date object as "YYYY-MM-DD" ISO date string using its UTC fields.
 */
function formatIsoDate(d: Date): string {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
