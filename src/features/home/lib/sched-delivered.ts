// Pure presentation math for the merged "Sched + Delivered" range card. No React
// here so the geometry (clamping, overage) and the take rate are unit-tested in
// isolation. The bar is scaled $0 → ceiling with the floor as a marker (locked
// 2026-06-08), so an early-year revenue below the floor reads as "not yet at the
// commitment" rather than a full bar.

import { SEGMENT_DEFS } from "./segments";
import type { ToplineSegment } from "./topline";

export interface RangeInput {
  revenue: number;
  take: number;
  floor: number;   // Σ minimum_purchase_amount across won contracts
  ceiling: number; // Σ maximum_budget across won contracts
}

export interface RangeGeometry {
  hasRange: boolean; // ceiling > 0
  revenuePct: number; // 0–100, clamped
  takePct: number;    // 0–100, clamped
  floorPct: number;   // 0–100, clamped
  overage: boolean;   // revenue exceeds the ceiling
}

export function computeRange({ revenue, take, floor, ceiling }: RangeInput): RangeGeometry {
  if (!(ceiling > 0)) {
    return { hasRange: false, revenuePct: 0, takePct: 0, floorPct: 0, overage: false };
  }
  // All clamp to [0,100] of the ceiling. take ⊂ revenue ≤ ceiling is the expected
  // invariant; takePct is additionally capped at revenuePct so the darker take
  // slice can never visually overrun the revenue fill even on pathological data.
  const pct = (v: number) => Math.max(0, Math.min(100, (v / ceiling) * 100));
  const revenuePct = pct(revenue);
  return {
    hasRange: true,
    revenuePct,
    takePct: Math.min(pct(take), revenuePct),
    floorPct: pct(floor),
    overage: revenue > ceiling,
  };
}

// Take is a function of revenue (margin / revenue). Null when there's no revenue
// to divide by, so the UI can hide the rate instead of printing NaN%. take ≤
// revenue in practice (take is a margin), so the ratio is in [0,1]; formatting/
// clamping for display is the caller's job.
export function takeRate(revenue: number, take: number): number | null {
  if (!(revenue > 0)) return null;
  return take / revenue;
}

// Utilization = how much of the contracted budget ceiling the money (delivered
// revenue, or take) has consumed. Mirrors the Revenue/Take Utilization modal's UTL
// column. Null when there's no budget to measure against. Can exceed 1 (overage).
export function utilization(money: number, maxBudget: number): number | null {
  if (!(maxBudget > 0)) return null;
  return money / maxBudget;
}

// Deferred = the contracted budget not yet consumed by delivered money (never
// negative; an overage shows as 0 deferred, not a negative).
export function deferred(money: number, maxBudget: number): number {
  return Math.max(0, maxBudget - money);
}

export interface MotionRow {
  key: string;
  label: string;
  revenue: number;
  take: number;
  rate: number | null;
}

// Merge the two per-motion breakdowns the API already returns (revenue card's
// segments + take card's segments) into one row set for the tooltip. Order and
// labels come from SEGMENT_DEFS so this can't drift from the rest of the dashboard.
export function mergeMotionRows(
  revenueSegments: ToplineSegment[],
  takeSegments: ToplineSegment[],
): MotionRow[] {
  const revByKey = new Map(revenueSegments.map((s) => [s.key, s.value]));
  const takeByKey = new Map(takeSegments.map((s) => [s.key, s.value]));
  return SEGMENT_DEFS.map(({ key, label }) => {
    const revenue = revByKey.get(key) ?? 0;
    const take = takeByKey.get(key) ?? 0;
    return { key, label, revenue, take, rate: takeRate(revenue, take) };
  }).filter((r) => r.revenue > 0 || r.take > 0);
}
