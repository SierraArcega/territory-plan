"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/features/shared/lib/format";
import { SEGMENT_DEFS, type SegmentKey } from "@/features/home/lib/segments";
import { type FunnelData, type FunnelStage, type OppView } from "@/features/home/lib/pipeline";
import MetricLabel from "../MetricLabel";
import RankPill from "../RankPill";
import StageFunnelChart from "./StageFunnelChart";
import StageDealsModal from "./StageDealsModal";

type SourceFilter = "all" | SegmentKey;
const fmt = (v: number) => formatCurrency(v, true);

const FUNNEL_TIP =
  "Open pipeline by stage, with pre-pipe targets on top. Each stage shows the customer's max budget (outer band) with the contractual minimum commit (solid inner band) nested inside. The Targets row is accounts on your plan that haven't booked a meeting yet — its values are projected.";
const SHARE_TIP =
  "Your committed minimum as a share of the whole team's, by deal source. Return = existing customers, New biz = cold, Win-back = lapsed.";

const SOURCE_PILLS: { key: SourceFilter; label: string; color?: string }[] = [
  { key: "all", label: "All sources" },
  ...SEGMENT_DEFS.map((d) => ({ key: d.key, label: d.label, color: d.color })),
];

// Consolidated Stage Funnel card: summary strip + trapezoid funnel (with the pre-pipe
// Targets row) + share-by-deal-source. Source pills filter the displayed caller stages
// and read per-source totals from the payload; the funnel geometry stays the all-sources
// view (team-scoped per-source stage shares are out of scope this pass).
export default function StageFunnelCard({ funnel, opps }: { funnel: FunnelData; opps: OppView[] }) {
  const [source, setSource] = useState<SourceFilter>("all");
  const [stage, setStage] = useState<number | null>(null);

  // Caller stages, re-scoped to the chosen source from the displayed opps (team share
  // unchanged — the route serves the all-sources funnel).
  const stages: FunnelStage[] = useMemo(() => {
    if (source === "all") return funnel.stages;
    return funnel.stages.map((s) => {
      const inStage = opps.filter((o) => o.stagePrefix === s.prefix && o.source === source);
      const min = inStage.reduce((a, o) => a + o.minPurchase, 0);
      return {
        ...s,
        count: inStage.length,
        min,
        max: inStage.reduce((a, o) => a + o.maxBudget, 0),
        sharePct: s.teamMin > 0 ? Math.round((min / s.teamMin) * 100) : 0,
      };
    });
  }, [funnel.stages, opps, source]);

  const filteredOpps = useMemo(() => (source === "all" ? opps : opps.filter((o) => o.source === source)), [opps, source]);
  const totalMin = source === "all" ? funnel.totalMin : stages.reduce((a, s) => a + s.min, 0);
  const totalMax = source === "all" ? funnel.totalMax : stages.reduce((a, s) => a + s.max, 0);
  const openCount = source === "all" ? funnel.openCount : filteredOpps.length;
  const maxBarPct = Math.max(40, ...funnel.sources.map((s) => s.pct));

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">
            <MetricLabel tip={FUNNEL_TIP}>Stage funnel</MetricLabel>
          </h3>
          <p className="text-xs text-[#8A80A8]">Targets and open pipe · min commit floor and max budget ceiling. Click a stage to drill in.</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {SOURCE_PILLS.map((p) => {
            const active = source === p.key;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => setSource(p.key)}
                aria-label={p.label}
                className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
                style={active ? { borderColor: p.color ?? "#403770", color: p.color ?? "#403770", background: "#F7F5FA" } : { borderColor: "#D4CFE2", color: "#5C5378" }}
              >
                {p.color && <span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap items-stretch gap-x-5 gap-y-3 rounded-md border border-[#EFEDF5] bg-[#F7F5FA] px-4 py-3">
        <SummaryCell label="Open opps" value={String(openCount)} />
        <SummaryCell label="Min commit · floor" value={fmt(totalMin)} />
        <SummaryCell label="Max budget · ceiling" value={fmt(totalMax)} muted />
        <SummaryCell label="Spread · upside" value={fmt(totalMax - totalMin)} />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">Share of team min</span>
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-[#403770] tabular-nums">{funnel.overallSharePct}%</span>
            <RankPill rank={funnel.rank} totalReps={funnel.totalReps} inRoster />
          </span>
        </div>
      </div>

      <StageFunnelChart stages={stages} targets={funnel.targets} won={funnel.won} overallSharePct={funnel.overallSharePct} onStageClick={setStage} />

      {/* Share by deal source */}
      <div className="flex flex-col gap-2 border-t border-[#EFEDF5] pt-3">
        <h4 className="text-xs font-bold text-[#403770] whitespace-nowrap">
          <MetricLabel tip={SHARE_TIP}>Share by deal source</MetricLabel>
        </h4>
        <div className="flex flex-col gap-2">
          {funnel.sources.map((s) => {
            const above = s.pct > funnel.overallSharePct + 2;
            const below = s.pct < funnel.overallSharePct - 4;
            return (
              <div key={s.key} className="grid grid-cols-[100px_1fr_auto_auto_auto] items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-[#5C5378] whitespace-nowrap">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="relative h-1.5 rounded-full bg-[#EFEDF5]">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (s.pct / maxBarPct) * 100)}%`, background: s.color }} />
                  <span className="absolute inset-y-[-2px] w-px bg-[#F37167]" style={{ left: `${Math.min(100, (funnel.overallSharePct / maxBarPct) * 100)}%` }} />
                </span>
                <span className="font-bold tabular-nums text-[#403770] whitespace-nowrap">{s.pct}%</span>
                <span className="tabular-nums text-[#8A80A8] whitespace-nowrap">{fmt(s.you)}<span className="text-[#C2BBD4]">/{fmt(s.team)}</span></span>
                <span
                  className="font-semibold whitespace-nowrap"
                  style={{ color: above ? "#4B8B6B" : below ? "#F37167" : "#A69DC0" }}
                >
                  {above ? "↗ above" : below ? "↘ below" : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <StageDealsModal stagePrefix={stage} opps={filteredOpps} onClose={() => setStage(null)} />
    </div>
  );
}

function SummaryCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">{label}</span>
      <span className={`text-lg font-bold tabular-nums whitespace-nowrap ${muted ? "text-[#8A80A8]" : "text-[#403770]"}`}>{value}</span>
    </div>
  );
}
