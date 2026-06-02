"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { SEGMENT_COLORS } from "@/features/home/lib/segments";
import type { Coverage } from "@/features/home/lib/pipeline";

// Stage accents reused for the by-stage coverage bar (plum ramp).
const STAGE_ACCENTS = ["#C2BBD4", "#9A8FC0", "#7E72A8", "#6E5FA8", "#544A85", "#403770"];

// Coverage card: the open book's min-commit floor / max-budget ceiling / most-likely
// weighted vs the gap to the FY bookings target, plus a by-stage floor/ceiling bar.
export default function CoverageCard({ coverage }: { coverage: Coverage & { wonBookings: number; fyTarget: number } }) {
  const { minCommit, maxBudget, weightedPipeline, gap, coverageMin, coverageMax, byStage, openCount } = coverage;
  const fmt = (v: number) => formatCurrency(v, true);
  const totalMax = byStage.reduce((s, x) => s + x.max, 0) || 1;

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Coverage</h3>
          <p className="text-xs text-[#8A80A8]">Is the open book big enough to close out the year.</p>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">Gap to target</div>
          <div className="text-lg font-bold tabular-nums text-[#403770]">{gap > 0 ? fmt(gap) : "Met"}</div>
        </div>
      </div>

      {/* Three stats */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Min commit · floor" value={fmt(minCommit)} sub={`${openCount} open opps`} />
        <Stat label="Max budget · ceiling" value={fmt(maxBudget)} sub={`headroom ${fmt(maxBudget - minCommit)}`} muted />
        <Stat
          label="Most likely"
          value={fmt(weightedPipeline)}
          sub={coverageMin != null && coverageMax != null ? `${coverageMin.toFixed(1)}–${coverageMax.toFixed(1)}× cover` : "target met"}
          accent
        />
      </div>

      {/* By-stage floor/ceiling bar */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
          By stage · max budget with min commit inside
        </span>
        <div className="flex h-5 w-full overflow-hidden rounded border border-[#E2DEEC]">
          {byStage.map((s, i) => {
            if (s.max <= 0) return null;
            return (
              <div key={s.prefix} style={{ width: `${(s.max / totalMax) * 100}%` }} className="relative">
                <div className="absolute inset-0" style={{ background: STAGE_ACCENTS[i], opacity: 0.22 }} />
                <div className="absolute inset-y-0 left-0" style={{ width: `${(s.min / s.max) * 100}%`, background: STAGE_ACCENTS[i] }} />
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {byStage.filter((s) => s.max > 0).map((s, i) => (
            <span key={s.prefix} className="flex items-center gap-1 text-[11px] whitespace-nowrap">
              <span className="h-2 w-2 rounded-[2px]" style={{ background: STAGE_ACCENTS[byStage.indexOf(s)] || SEGMENT_COLORS.return }} />
              <span className="font-medium text-[#5C5378]">{s.name}</span>
              <span className="font-bold tabular-nums text-[#403770]">{fmt(s.min)}</span>
              <span className="text-[#8A80A8]">/ {fmt(s.max)}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, muted, accent }: { label: string; value: string; sub: string; muted?: boolean; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${accent ? "text-[#F37167]" : muted ? "text-[#8A80A8]" : "text-[#403770]"}`}>{value}</span>
      <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">{sub}</span>
    </div>
  );
}
