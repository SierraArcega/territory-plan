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

/** Returns today's date as a YYYY-MM-DD string. */
export function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Returns a YYYY-MM-DD string key for a given Date (local time). */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Returns the first day of the month for a given Date. */
export function getMonthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Returns the last day of the month for a given Date. */
export function getMonthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

/** Returns true if two Dates fall on the same calendar day (ignores time). */
export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Format an ISO datetime string as a short locale time.
 * e.g. "2026-03-14T09:30:00.000Z" → "9:30 AM"
 */
export function formatTimeShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
