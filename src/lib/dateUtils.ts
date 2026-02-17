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
