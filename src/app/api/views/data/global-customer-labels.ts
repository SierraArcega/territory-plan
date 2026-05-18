/**
 * Global customer rank + label resolution for the districts grid.
 *
 * Reads district_financials rows for vendor='fullmind' across FY24/25/26,
 * ranks districts with FY26 revenue descending, and labels districts
 * without FY26 revenue as 'win_back' (had FY24 or FY25) or 'new' (no
 * recent revenue history).
 *
 * Cached in module-scoped memory with a 5-minute TTL — the underlying
 * district_financials table refreshes hourly so stale-by-5min is fine.
 */
import prisma from "@/lib/prisma";

export type LabelKind = "rank" | "win_back" | "new";

export interface GlobalLabel {
  rank: number | null;
  label: LabelKind;
}

interface RevenueRow {
  leaid: string;
  fy26: number | null;
  fy25: number | null;
  fy24: number | null;
}

const TTL_MS = 5 * 60 * 1000;

let cache: { byLeaid: Map<string, GlobalLabel>; expiresAt: number } | null = null;

/** Test-only cache reset. */
export function __resetCacheForTests(): void {
  cache = null;
}

/**
 * Pure function — takes revenue rows, returns the labeled Map. Exported for
 * unit-testing without a database.
 */
export function computeLabelsFromRows(rows: RevenueRow[]): Map<string, GlobalLabel> {
  const withFy26 = rows
    .map((r) => ({ leaid: r.leaid, fy26: Number(r.fy26 ?? 0), fy25: Number(r.fy25 ?? 0), fy24: Number(r.fy24 ?? 0) }))
    .filter((r) => r.fy26 > 0)
    .sort((a, b) => b.fy26 - a.fy26);

  const byLeaid = new Map<string, GlobalLabel>();

  // Compute dense-ish RANK() — ties share the lowest rank, the next distinct
  // value skips by the size of the tie group (matches Postgres RANK()).
  let prevVal: number | null = null;
  let prevRank = 0;
  withFy26.forEach((r, idx) => {
    const rank = r.fy26 === prevVal ? prevRank : idx + 1;
    byLeaid.set(r.leaid, { rank, label: "rank" });
    prevVal = r.fy26;
    prevRank = rank;
  });

  for (const r of rows) {
    if (byLeaid.has(r.leaid)) continue;
    const fy25 = Number(r.fy25 ?? 0);
    const fy24 = Number(r.fy24 ?? 0);
    const label: LabelKind = fy25 > 0 || fy24 > 0 ? "win_back" : "new";
    byLeaid.set(r.leaid, { rank: null, label });
  }

  return byLeaid;
}

/** Default fetcher — runs the rank CTE. Injected for testing. */
async function defaultFetcher(): Promise<Map<string, GlobalLabel>> {
  const rows = await prisma.$queryRaw<RevenueRow[]>`
    SELECT
      leaid,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '26')::float AS fy26,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '25')::float AS fy25,
      SUM(total_revenue) FILTER (WHERE fiscal_year = '24')::float AS fy24
    FROM district_financials
    WHERE vendor = 'fullmind'
      AND fiscal_year IN ('24', '25', '26')
      AND leaid IS NOT NULL
    GROUP BY leaid
  `.catch(() => [] as RevenueRow[]);
  return computeLabelsFromRows(rows);
}

/**
 * Returns the labeled Map, cached for 5 minutes. The fetcher arg is for
 * tests — production callers pass nothing.
 */
export async function getGlobalCustomerLabels(
  fetcher: () => Promise<Map<string, GlobalLabel>> = defaultFetcher,
): Promise<Map<string, GlobalLabel>> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.byLeaid;
  const byLeaid = await fetcher();
  cache = { byLeaid, expiresAt: now + TTL_MS };
  return byLeaid;
}
