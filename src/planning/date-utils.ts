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

/**
 * Get the Monday of the week containing the given date (or today).
 * Uses ISO week rules where Monday is the start of the week.
 *
 * @param dateStr - Optional ISO "YYYY-MM-DD" string representing today in the user's timezone.
 *                  Falls back to server local time if not provided (backward-compatible).
 * @returns ISO date string "YYYY-MM-DD" for that Monday
 */
export function getWeekStartDate(dateStr?: string): string {
  const d = dateStr ? new Date(dateStr + "T00:00:00") : new Date();
  // JavaScript: Sunday=0, Monday=1, ..., Saturday=6
  // We want Monday=0, so adjust: (jsDay + 6) % 7 gives Mon=0..Sun=6
  const jsDay = d.getDay();
  const daysSinceMonday = (jsDay + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  return formatIsoDate(d);
}

/**
 * Format a date range for display in plan headers.
 * Takes a Monday ISO date and returns "Mon DD - Mon DD" (e.g., "Feb 10 - Feb 16").
 *
 * @param weekStartDate - ISO date string "YYYY-MM-DD" for a Monday
 * @returns Formatted range string like "Feb 10 - Feb 16"
 */
export function formatDateRange(weekStartDate: string): string {
  const start = new Date(weekStartDate + "T00:00:00");
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const months = [
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
  ];

  const startMonth = months[start.getMonth()];
  const endMonth = months[end.getMonth()];

  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
  }
  return `${startMonth} ${start.getDate()} - ${endMonth} ${end.getDate()}`;
}

/**
 * Add N days to an ISO date string and return new ISO date string.
 *
 * @param dateStr - ISO date string "YYYY-MM-DD"
 * @param days - Number of days to add (can be negative)
 * @returns ISO date string "YYYY-MM-DD"
 */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return formatIsoDate(d);
}

/**
 * Format a Date object as "YYYY-MM-DD" ISO date string.
 */
function formatIsoDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
