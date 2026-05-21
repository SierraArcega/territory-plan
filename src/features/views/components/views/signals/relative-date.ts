/**
 * Relative-date formatting for Signals rows.
 *
 * Compact age strings ("today", "2d", "3w", "5mo") used in district freshness
 * badges and leaf-row dates. Kept tiny + framework-free so both row components
 * and tests can share it without a render.
 */

/** Compact relative age, e.g. "today" / "2d" / "3w" / "5mo". `—` on bad input. */
export function relativeAge(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffDays = Math.floor((now - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays < 14) return `${diffDays}d`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)}w`;
  return `${Math.floor(diffDays / 30)}mo`;
}

/**
 * True when `iso` is strictly newer than the `lastVisitMs` watermark. Used to
 * decide whether to show the coral "new" dot. Returns false when either input
 * is missing (no watermark on first visit → no dot, avoiding a sea of dots).
 */
export function isNewerThan(
  iso: string | null | undefined,
  lastVisitMs: number | null,
): boolean {
  if (!iso || lastVisitMs == null) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  return t > lastVisitMs;
}
