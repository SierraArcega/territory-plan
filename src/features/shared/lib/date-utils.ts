/**
 * Parse a date string (ISO or YYYY-MM-DD) into a Date at local midnight.
 *
 * API dates come back as UTC midnight (e.g. "2026-02-12T00:00:00.000Z").
 * Using `new Date()` directly converts that to the local timezone, which
 * in US timezones shifts the date back one day (UTC midnight = previous
 * evening locally). This helper strips the time/timezone and forces
 * local-midnight parsing so the calendar date stays correct.
 */
export function parseLocalDate(dateString: string): Date {
  const datePart = dateString.split("T")[0];
  return new Date(datePart + "T00:00:00");
}

/**
 * Coerce a Date or date string into a Date.
 * Date-only strings ("2026-02-12") parse at local midnight (via
 * parseLocalDate) so they don't shift a day; full ISO timestamps keep
 * their time component.
 */
function toDate(date: string | Date): Date {
  if (date instanceof Date) return date;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? parseLocalDate(date) : new Date(date);
}

/**
 * Format a date as a short calendar date: "Feb 12".
 * The year is appended only when it differs from the current year:
 * "Dec 31, 2025". String inputs are treated as calendar dates via
 * parseLocalDate (UTC-midnight API dates must not shift a day).
 * Pass `now` to pin "current year" in tests.
 */
export function fmtDate(date: string | Date, now: Date = new Date()): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/**
 * Format a timestamp as coarse relative time: "just now" (< ~30 min),
 * "2h ago", "yesterday", "3d ago". Future timestamps clamp to "just now".
 * Pass `now` to pin the reference time in tests.
 */
export function fmtRel(date: string | Date, now: Date = new Date()): string {
  const ms = now.getTime() - toDate(date).getTime();
  if (ms < 0) return "just now";
  const hours = Math.round(ms / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
