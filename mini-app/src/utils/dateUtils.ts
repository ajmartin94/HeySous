/**
 * Client-side date utilities for Monday-based week calculations.
 * Duplicated from server-side logic (no shared imports across build boundary).
 */

/** Day names starting from Monday (index 0) through Sunday (index 6). */
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
 * Returns today's index in Monday-based week: 0=Monday..6=Sunday.
 * Uses the same `(jsDay + 6) % 7` conversion as the server.
 */
export function getTodayIndex(): number {
  return (new Date().getDay() + 6) % 7;
}

/**
 * Formats a day header like "Monday, Feb 10" given a week start date
 * and a day offset (0-6).
 *
 * @param weekStartDate - ISO YYYY-MM-DD string (the Monday of the week)
 * @param dayOfWeek - 0=Monday through 6=Sunday
 * @returns Formatted string like "Monday, Feb 10"
 */
export function formatDayHeader(
  weekStartDate: string,
  dayOfWeek: number
): string {
  // Parse as local date to avoid timezone shift
  const date = new Date(weekStartDate + "T00:00:00");
  date.setDate(date.getDate() + dayOfWeek);

  const dayName = DAY_NAMES[dayOfWeek];
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.getDate();

  return `${dayName}, ${month} ${day}`;
}

/**
 * Returns true if the given day is in the past for the current week.
 * For next week, always returns false.
 *
 * @param dayOfWeek - 0=Monday through 6=Sunday
 * @param isCurrentWeek - true if viewing the current week
 */
export function isPastDay(dayOfWeek: number, isCurrentWeek: boolean): boolean {
  if (!isCurrentWeek) return false;
  return dayOfWeek < getTodayIndex();
}
