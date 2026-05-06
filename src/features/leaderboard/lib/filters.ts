import type { IncreaseTarget, IncreaseTargetCategory } from "./types";

export type RevenueBand = "lt-50k" | "50k-250k" | "250k-1m" | "1m+";

/**
 * Sentinel value placed in `lastReps` to match rows whose lastClosedWon
 * has no rep name (the previous "Unassigned / no previous rep" radio option).
 */
export const UNASSIGNED_REP = "__unassigned";

export interface LHFFilters {
  categories: IncreaseTargetCategory[];
  states: string[];
  products: string[];
  revenueBand: RevenueBand | null;
  /**
   * Multi-select on `lastClosedWon.repName`. Empty array = no filter.
   * Use `UNASSIGNED_REP` as a sentinel for rows with no prior rep.
   */
  lastReps: string[];
}

export const DEFAULT_FILTERS: LHFFilters = {
  categories: [],
  states: [],
  products: [],
  revenueBand: null,
  lastReps: [],
};

const BAND_RANGES: Record<RevenueBand, [number, number]> = {
  "lt-50k": [0, 50_000],
  "50k-250k": [50_000, 250_000],
  "250k-1m": [250_000, 1_000_000],
  "1m+": [1_000_000, Infinity],
};

function rowRevenue(r: IncreaseTarget): number {
  return r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue;
}

export function applyFilters(
  rows: IncreaseTarget[],
  f: LHFFilters,
): IncreaseTarget[] {
  return rows.filter((r) => {
    if (f.categories.length > 0 && !f.categories.includes(r.category)) return false;
    if (f.states.length > 0 && !f.states.includes(r.state)) return false;
    if (
      f.products.length > 0 &&
      !r.productTypes.some((p) => f.products.includes(p))
    )
      return false;
    if (f.revenueBand) {
      const [lo, hi] = BAND_RANGES[f.revenueBand];
      const v = rowRevenue(r);
      if (v < lo || v >= hi) return false;
    }
    if (f.lastReps.length > 0) {
      const repKey = r.lastClosedWon?.repName ?? UNASSIGNED_REP;
      if (!f.lastReps.includes(repKey)) return false;
    }
    return true;
  });
}

interface ReadableSearchParams {
  get(name: string): string | null;
}

export function filtersToSearchParams(f: LHFFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.categories.length) p.set("category", f.categories.join(","));
  if (f.states.length) p.set("state", f.states.join(","));
  if (f.products.length) p.set("product", f.products.join(","));
  if (f.revenueBand) p.set("rev", f.revenueBand);
  if (f.lastReps.length) p.set("lastRep", f.lastReps.join(","));
  return p;
}

export function filtersFromSearchParams(
  p: URLSearchParams | ReadableSearchParams,
): LHFFilters {
  const get = (k: string): string | null => p.get(k);
  const csv = (k: string): string[] => get(k)?.split(",").filter(Boolean) ?? [];

  const validBands: RevenueBand[] = ["lt-50k", "50k-250k", "250k-1m", "1m+"];
  const bandRaw = get("rev");
  const band = validBands.includes(bandRaw as RevenueBand)
    ? (bandRaw as RevenueBand)
    : null;

  return {
    categories: csv("category").filter(
      (c): c is IncreaseTargetCategory =>
        c === "missing_renewal" ||
        c === "fullmind_winback" ||
        c === "ek12_winback",
    ),
    states: csv("state").map((s) => s.toUpperCase()),
    products: csv("product"),
    revenueBand: band,
    lastReps: csv("lastRep"),
  };
}
