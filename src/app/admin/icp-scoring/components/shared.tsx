"use client";

import type { ReactNode } from "react";

// ─── Color Constants ────────────────────────────────────────────────────────

export const SCORE_COLORS = {
  fit: "#403770",
  value: "#69B34A",
  readiness: "#D4A84B",
  state: "#6EA3BE",
  composite: "#F37167",
} as const;

export const SCORE_BAR_CLASSES = {
  fit: "bg-[#403770]",
  value: "bg-[#69B34A]",
  readiness: "bg-[#D4A84B]",
  state: "bg-[#6EA3BE]",
  composite: "bg-[#F37167]",
} as const;

export const TIER_FILLS = {
  "Tier 1": "#F37167",
  "Tier 2": "#D4A84B",
  "Tier 3": "#8A80A8",
  "Tier 4": "#D4CFE2",
} as const;

export const TIER_BADGE_CLASSES: Record<string, string> = {
  "Tier 1": "bg-[#fef1f0] text-[#c25a52] border-[#f58d85]",
  "Tier 2": "bg-[#fffaf1] text-[#997c43] border-[#ffd98d]",
  "Tier 3": "bg-[#EFEDF5] text-[#8A80A8] border-[#D4CFE2]",
  "Tier 4": "bg-[#F7F5FA] text-[#A69DC0] border-[#E2DEEC]",
};

export const LOCALE_MAP: Record<number, string> = {
  11: "City-Large", 12: "City-Mid", 13: "City-Small",
  21: "Sub-Large", 22: "Sub-Mid", 23: "Sub-Small",
  31: "Town-Fringe", 32: "Town-Distant", 33: "Town-Remote",
  41: "Rural-Fringe", 42: "Rural-Distant", 43: "Rural-Remote",
};

export const SCORE_LABELS: Record<string, string> = {
  fit: "Fit",
  value: "Value",
  readiness: "Readiness",
  state: "State",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

export function fmtNum(
  v: number | null | undefined,
  opts?: { pct?: boolean; dollar?: boolean; compact?: boolean },
): string {
  if (v == null) return "\u2014";
  if (opts?.dollar) {
    if (Math.abs(v) >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (Math.abs(v) >= 1e3) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
    return `$${v.toFixed(2)}`;
  }
  if (opts?.pct) return `${v.toFixed(1)}%`;
  if (opts?.compact && Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

/** Maps a composite score to its tier color hex for chart fills. */
export function scoreRangeColor(score: number): string {
  if (score >= 60) return TIER_FILLS["Tier 1"];
  if (score >= 40) return TIER_FILLS["Tier 2"];
  if (score >= 20) return TIER_FILLS["Tier 3"];
  return TIER_FILLS["Tier 4"];
}

// ─── Shared Components ──────────────────────────────────────────────────────

export function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 bg-[#EFEDF5] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-7 text-right font-medium text-[#6E6390]">{value}</span>
    </div>
  );
}

export function SortArrow({ direction, active }: { direction: "asc" | "desc"; active: boolean }) {
  const color = active ? "#403770" : "#A69DC0";
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="w-3 h-3" aria-hidden="true">
      {direction === "asc" ? (
        <path d="M6 2.5L10 8.5H2L6 2.5Z" fill={color} />
      ) : (
        <path d="M6 9.5L2 3.5H10L6 9.5Z" fill={color} />
      )}
    </svg>
  );
}

export function TierBadge({ tier }: { tier: string }) {
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${TIER_BADGE_CLASSES[tier] || ""}`}>
      {tier.replace("Tier ", "T")}
    </span>
  );
}

export function SectionCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-6">
      <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
      {description && <p className="text-sm text-[#8A80A8] mt-1 mb-4">{description}</p>}
      {!description && <div className="mt-4" />}
      {children}
    </div>
  );
}

export function ChartTooltip({ active, payload, label, valueLabel }: {
  active?: boolean;
  payload?: Array<{ value: number; name: string }>;
  label?: string;
  valueLabel?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-[#D4CFE2] rounded-lg shadow-lg p-3">
      <p className="text-xs font-semibold text-[#403770] mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs text-[#6E6390]">
          {valueLabel || p.name}: <span className="font-medium text-[#544A78]">{fmtNum(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

export function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-[#F7F5FA] rounded-lg px-3 py-2 border border-[#E2DEEC]">
      <div className="text-xs text-[#A69DC0] font-medium">{label}</div>
      <div className="text-lg font-bold text-[#544A78] tabular-nums">{value}</div>
      {sub && <div className="text-[10px] text-[#A69DC0]">{sub}</div>}
    </div>
  );
}
