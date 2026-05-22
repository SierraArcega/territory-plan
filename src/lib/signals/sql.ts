/**
 * Shared SQL helpers for the Signals view endpoints
 * (`GET /api/signals` summary and `GET /api/signals/[leaid]` items).
 *
 * Signals merge three sources — Vacancies, News, RFPs — grouped per district.
 * Canonical date / scope rules live here so the summary and items endpoints
 * stay in lockstep:
 *
 *   - Vacancies: `COALESCE(date_posted, first_seen_at)`, district key `leaid`.
 *   - News:      `published_at`, district key via `news_article_districts.leaid`
 *                with `confidence IN ('high','llm','source')` (matches /api/news).
 *   - RFPs:      `captured_date` (canonical, matches the existing feed + sort);
 *                `due_date` surfaced as secondary meta. District key `leaid`
 *                (NULL excluded by `= ANY`, so unresolved RFPs drop out).
 *
 * All callers MUST pass user input as bound parameters ($1, $2, …) — these
 * helpers only emit static SQL fragments and never interpolate values.
 */

/** Time-window option for the `since` filter. */
export type SignalWindow = "7d" | "30d" | "90d" | "all";

/** The set of signal sources, keyed by their short type code. */
export interface TypeMask {
  vac: boolean;
  news: boolean;
  rfp: boolean;
}

/** A signal source short code, used in `types` CSV params and item rows. */
export type SignalType = "vac" | "news" | "rfp";

const WINDOW_DAYS: Record<Exclude<SignalWindow, "all">, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

/**
 * Parse a raw `since` query param into a validated window. Defaults to `30d`
 * when null/empty/unknown.
 */
export function parseWindow(raw: string | null): SignalWindow {
  switch (raw) {
    case "7d":
    case "30d":
    case "90d":
    case "all":
      return raw;
    default:
      return "30d";
  }
}

/**
 * Resolve a window to a cutoff Date. Signals with a chronological date strictly
 * *before* this cutoff are excluded. Returns `null` for the `all` window (no
 * lower bound).
 *
 * @param now - injectable clock for deterministic tests; defaults to `new Date()`.
 */
export function sinceCutoff(
  window: SignalWindow,
  now: Date = new Date(),
): Date | null {
  if (window === "all") return null;
  const days = WINDOW_DAYS[window];
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

/**
 * Parse a `types` CSV (e.g. "vac,news") into a per-source boolean mask.
 * When the param is null, empty, or contains no recognized codes, ALL three
 * sources default to ON — the unfiltered view.
 */
export function parseTypes(csv: string | null): TypeMask {
  if (csv == null) return { vac: true, news: true, rfp: true };
  const tokens = csv
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (tokens.length === 0) return { vac: true, news: true, rfp: true };

  const mask: TypeMask = { vac: false, news: false, rfp: false };
  for (const t of tokens) {
    if (t === "vac") mask.vac = true;
    else if (t === "news") mask.news = true;
    else if (t === "rfp") mask.rfp = true;
  }
  // If the CSV had only unrecognized tokens, fall back to all-on so the view
  // never silently renders nothing because of a typo'd param.
  if (!mask.vac && !mask.news && !mask.rfp) {
    return { vac: true, news: true, rfp: true };
  }
  return mask;
}

/**
 * News confidence levels treated as a real district association (mirrors the
 * default filter in /api/news).
 */
export const NEWS_CONFIDENCE_LEVELS = ["high", "llm", "source"] as const;

/**
 * Canonical chronological-date SQL expression per source, relative to a table
 * alias. Used for `since` filtering, `MAX()` newest rollups, and `ORDER BY`.
 */
export const DATE_EXPR = {
  /** vacancies: posted date with first-seen fallback. */
  vac: (alias: string) => `COALESCE(${alias}.date_posted, ${alias}.first_seen_at)`,
  /** news_articles: published date. */
  news: (alias: string) => `${alias}.published_at`,
  /** rfps: captured (ingest) date — matches the existing feed order. */
  rfp: (alias: string) => `${alias}.captured_date`,
} as const;
