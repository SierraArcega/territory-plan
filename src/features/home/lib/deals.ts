// Pure types + derivations behind the topline detail modals (/deals route). The
// SQL lives in deals-source.ts (verified live, not unit-tested); everything here is
// pure and covered in deals.test.ts. Domain rules locked in the design doc:
//   - utilization (rev/take) uses WON opps only for each account's min/max — the
//     contracted book that actually generates revenue.
//   - deferred = the unconsumed contractual floor (churn risk).
//   - utilPct is guarded against a zero ceiling (returns null, never NaN/Infinity).

import type { SegmentKey } from "./segments";

export type DealMetric = "pipeline" | "bookings" | "rev" | "take";

// ── Row shapes (one per metric; the modal switches on the metric) ─────────────

export interface PipelineDealRow {
  account: string;
  state: string | null;
  stageName: string;
  source: SegmentKey | null; // DOA segment (motion), NOT contract_type
  committed: number; // net booking amount
  maxBudget: number;
  closeDate: string | null;
}

export interface BookingDealRow {
  account: string;
  product: string | null; // contract_type tier — distinct from `source` (motion)
  source: SegmentKey | null;
  amount: number; // net booking (signed)
  minCommit: number;
  maxBudget: number;
  closedDate: string | null;
}

export interface UtilizationRow {
  account: string;
  source: SegmentKey | null;
  minCommit: number; // Σ minimum_purchase_amount (won)
  maxBudget: number; // Σ maximum_budget (won)
  revenue: number; // DOA delivered revenue
  take: number; // DOA delivered take
  deferred: number; // max(0, minCommit - revenue) — unconsumed floor
  utilPct: number | null; // revenue / maxBudget; null when maxBudget == 0
  underMin: boolean; // revenue < minCommit
}

// ── Inputs to the utilization derivation (per-district aggregates from SQL) ────

export interface WonAccountAgg {
  leaid: string;
  account: string;
  source: SegmentKey | null;
  minCommit: number;
  maxBudget: number;
}

export interface DoaAccountAgg {
  leaid: string;
  revenue: number; // DOA completed_revenue
  take: number; // DOA completed_take
}

// Merge each account's won-opp commitment floor/ceiling with its DOA delivered
// revenue/take. Rows are keyed by district (leaid) and aggregated defensively in
// case SQL returns more than one row per district (e.g. one per category). Sorted
// by contracted size (max budget desc) so the biggest accounts lead; account name
// breaks ties for a stable order.
export function buildUtilizationRows(
  won: WonAccountAgg[],
  doa: DoaAccountAgg[],
): UtilizationRow[] {
  const wonByLea = new Map<string, { account: string; source: SegmentKey | null; minCommit: number; maxBudget: number }>();
  for (const w of won) {
    const acc = wonByLea.get(w.leaid);
    if (acc) {
      acc.minCommit += w.minCommit;
      acc.maxBudget += w.maxBudget;
      if (acc.source == null) acc.source = w.source;
    } else {
      wonByLea.set(w.leaid, { account: w.account, source: w.source, minCommit: w.minCommit, maxBudget: w.maxBudget });
    }
  }

  const doaByLea = new Map<string, { revenue: number; take: number }>();
  for (const d of doa) {
    const acc = doaByLea.get(d.leaid);
    if (acc) {
      acc.revenue += d.revenue;
      acc.take += d.take;
    } else {
      doaByLea.set(d.leaid, { revenue: d.revenue, take: d.take });
    }
  }

  const rows: UtilizationRow[] = [];
  for (const [leaid, w] of wonByLea) {
    const delivered = doaByLea.get(leaid);
    const revenue = delivered?.revenue ?? 0;
    const take = delivered?.take ?? 0;
    rows.push({
      account: w.account,
      source: w.source,
      minCommit: w.minCommit,
      maxBudget: w.maxBudget,
      revenue,
      take,
      deferred: Math.max(0, w.minCommit - revenue),
      utilPct: w.maxBudget > 0 ? revenue / w.maxBudget : null,
      underMin: revenue < w.minCommit,
    });
  }
  return rows.sort((a, b) => b.maxBudget - a.maxBudget || a.account.localeCompare(b.account));
}

// ── Totals footer per metric ──────────────────────────────────────────────────

export interface DealTotals {
  count: number;
  committed?: number; // pipeline: Σ net booking
  amount?: number; // bookings: Σ signed net booking
  minCommit?: number;
  maxBudget?: number;
  revenue?: number; // rev/take
  take?: number; // rev/take
  deferred?: number; // rev/take
  utilPct?: number | null; // rev/take: blended Σrevenue / Σmaxbudget
}

function sum<T>(rows: T[], pick: (r: T) => number): number {
  return rows.reduce((s, r) => s + pick(r), 0);
}

// Footer totals for the open metric. Pipeline/bookings sum money straight; rev/take
// also derive a BLENDED utilization (Σrevenue / Σmaxbudget), not the mean of the
// per-row percentages, so a few large accounts dominate as they should.
export function buildDealTotals(
  metric: DealMetric,
  rows: PipelineDealRow[] | BookingDealRow[] | UtilizationRow[],
): DealTotals {
  if (metric === "pipeline") {
    const r = rows as PipelineDealRow[];
    return { count: r.length, committed: sum(r, (x) => x.committed), maxBudget: sum(r, (x) => x.maxBudget) };
  }
  if (metric === "bookings") {
    const r = rows as BookingDealRow[];
    return {
      count: r.length,
      amount: sum(r, (x) => x.amount),
      minCommit: sum(r, (x) => x.minCommit),
      maxBudget: sum(r, (x) => x.maxBudget),
    };
  }
  // rev | take
  const r = rows as UtilizationRow[];
  const maxBudget = sum(r, (x) => x.maxBudget);
  const revenue = sum(r, (x) => x.revenue);
  return {
    count: r.length,
    minCommit: sum(r, (x) => x.minCommit),
    maxBudget,
    revenue,
    take: sum(r, (x) => x.take),
    deferred: sum(r, (x) => x.deferred),
    utilPct: maxBudget > 0 ? revenue / maxBudget : null,
  };
}
