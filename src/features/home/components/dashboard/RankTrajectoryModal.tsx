"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { X, ChevronRight, Download } from "lucide-react";
import { formatCurrency } from "@/features/shared/lib/format";
import { useRankTrajectory } from "@/features/home/lib/queries";
import type { MetricSeries } from "@/features/home/lib/rank-trajectory";
import RankTrajectoryChart, { type RankSeries } from "./charts/RankTrajectoryChart";

type SegmentKey = "all" | "return" | "new" | "winback" | "expansion";

const SEGMENTS: { key: SegmentKey; label: string; color?: string }[] = [
  { key: "all", label: "All" },
  { key: "return", label: "Return business", color: "#403770" },
  { key: "new", label: "New business", color: "#F37167" },
  { key: "winback", label: "Win-back", color: "#6EA3BE" },
  { key: "expansion", label: "Expansion", color: "#FFCF70" },
];
const SEGMENT_COLORS: Record<string, string> = {
  return: "#403770", new: "#F37167", winback: "#6EA3BE", expansion: "#FFCF70",
};
const GHOST = "rgba(140, 128, 168, 0.32)";
const fmt = (v: number) => formatCurrency(v, true);

// Resolve a metric to the active segment's series (falling back to all-segments
// when that metric has no rows in the selected segment).
function viewFor(metric: MetricSeries, segment: SegmentKey) {
  if (segment === "all") return { caller: metric.caller, reps: metric.reps };
  return metric.segments[segment] ?? { caller: metric.caller, reps: metric.reps };
}

interface Props {
  open: boolean;
  onClose: () => void;
  fy: number;
}

export default function RankTrajectoryModal({ open, onClose, fy }: Props) {
  const { data } = useRankTrajectory(fy);
  const [isolated, setIsolated] = useState<string | null>(null);
  const [segment, setSegment] = useState<SegmentKey>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  const totalReps = useMemo(
    () => (data ? Math.max(1, ...data.metrics.map((m) => m.reps.length)) : 1),
    [data],
  );

  if (!open || !data) return null;

  const { columns, todayIndex, metrics } = data;
  const refIdx = todayIndex;
  const segActive = segment !== "all";
  const segMeta = SEGMENTS.find((s) => s.key === segment)!;
  const isolatedMetric = isolated ? metrics.find((m) => m.metricKey === isolated) ?? null : null;
  const visibleMetrics = isolatedMetric ? [isolatedMetric] : metrics;

  const toggleExpand = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  // Chart series: isolated → ghosted teammates behind the caller's colored line.
  let chartSeries: RankSeries[];
  if (isolatedMetric) {
    const view = viewFor(isolatedMetric, segment);
    chartSeries = [
      ...view.reps.filter((r) => !r.isCaller).map((r) => ({ name: r.name, color: GHOST, ranks: r.ranks, ghost: true })),
      { name: isolatedMetric.name, color: isolatedMetric.color, ranks: view.caller.ranks },
    ];
  } else {
    chartSeries = metrics.map((m) => ({ name: m.name, color: m.color, ranks: viewFor(m, segment).caller.ranks }));
  }

  function exportCsv() {
    if (!data) return;
    const header = ["Metric", "Segment", ...columns];
    const rows = visibleMetrics.map((m) => {
      const v = viewFor(m, segment);
      return [m.name, segMeta.label, ...v.caller.values.map((x) => Math.round(x))];
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    if (typeof URL?.createObjectURL !== "function") return; // jsdom / unsupported
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `rank-trajectory-FY${String(fy).slice(-2)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#403770]/60 p-4 sm:p-8"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Rank trajectory — expanded"
    >
      <div className="w-[96vw] max-w-[1480px] rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E2DEEC] p-5">
          <div>
            <h2 className="text-lg font-bold text-[#403770]">Rank trajectory</h2>
            <p className="mt-0.5 text-xs text-[#8A80A8]">
              {isolatedMetric ? (
                <>Showing <strong style={{ color: isolatedMetric.color }}>{isolatedMetric.name}</strong>{segActive && <> · <strong style={{ color: SEGMENT_COLORS[segment] }}>{segMeta.label}</strong></>} across all {totalReps} reps — your line is in color, teammates in gray.</>
              ) : (
                <>All metrics, month by month. Click a metric to compare against the team, or filter by segment.</>
              )}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-md p-1 text-[#5C5378] hover:bg-[#EFEDF5]">
            <X size={16} />
          </button>
        </div>

        {/* Toolbar: metric pills + FY label */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-4">
          <button
            type="button"
            onClick={() => setIsolated(null)}
            className={`rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${!isolated ? "border-[#403770] bg-[#403770] text-white" : "border-[#D4CFE2] bg-white text-[#5C5378] hover:bg-[#EFEDF5]"}`}
          >
            All metrics <span className="tabular-nums">{metrics.length}</span>
          </button>
          {metrics.map((m) => (
            <button
              key={m.metricKey}
              type="button"
              onClick={() => setIsolated(m.metricKey)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap ${isolated === m.metricKey ? "border-[#403770] bg-[#403770] text-white" : "border-[#D4CFE2] bg-white text-[#5C5378] hover:bg-[#EFEDF5]"}`}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
              {m.name}
            </button>
          ))}
          <span className="ml-auto rounded-full border border-[#D4CFE2] px-3 py-1 text-xs font-semibold text-[#403770] whitespace-nowrap">
            FY{String(fy).slice(-2)}
          </span>
        </div>

        {/* Segment filter */}
        <div className="flex flex-wrap items-center gap-2 px-5 pt-3" role="tablist" aria-label="Segment filter">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">Segment</span>
          {SEGMENTS.map((opt) => {
            const active = segment === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSegment(opt.key)}
                className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap"
                style={
                  active
                    ? { borderColor: opt.color ?? "#403770", color: opt.color ?? "#403770", backgroundColor: "#F7F5FA" }
                    : { borderColor: "#D4CFE2", color: "#5C5378" }
                }
              >
                {opt.color && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: opt.color }} />}
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Chart */}
        <div className="px-5 pt-4">
          <RankTrajectoryChart series={chartSeries} months={columns as string[]} carryover todayIndex={todayIndex} totalRanks={totalReps} hideEndLabels height={420} />
        </div>

        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-3 px-5 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          {visibleMetrics.map((m) => {
            const view = viewFor(m, segment);
            const todayVal = view.caller.values[refIdx];
            const totalVal = m.caller.values[refIdx] || 1;
            const share = segActive ? (todayVal / totalVal) * 100 : 100;
            return (
              <div key={m.metricKey} className="rounded-lg border border-[#E2DEEC] bg-[#F7F5FA] p-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                  <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">{m.name}</span>
                  <span className="text-xs font-bold tabular-nums text-[#F37167]">#{view.caller.ranks[refIdx]}</span>
                </div>
                <div className="mt-1 text-lg font-bold tabular-nums text-[#403770]">{fmt(todayVal)}</div>
                <div className="text-[11px] text-[#8A80A8] whitespace-nowrap">
                  {segActive ? <><span style={{ color: SEGMENT_COLORS[segment], fontWeight: 700 }}>{share.toFixed(0)}%</span> of {m.name.toLowerCase()}</> : <>FY to date · all segments</>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Monthly table */}
        <div className="px-5 pt-5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
            Monthly ranks {isolatedMetric ? `· ${isolatedMetric.name}` : "· all metrics"}
            {segActive && <span style={{ color: SEGMENT_COLORS[segment] }}> · {segMeta.label}</span>}
          </div>
          <div className="overflow-x-auto rounded-lg border border-[#E2DEEC]">
            <table className="min-w-full text-left">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[200px] bg-white px-3 py-2 text-xs font-semibold text-[#5C5378]">Metric</th>
                  {columns.map((c, i) => {
                    const isCarry = i === 0;
                    const isFuture = i > todayIndex;
                    return (
                      <th key={c + i} className="min-w-[72px] px-2.5 py-2 text-right text-[11px] font-semibold tabular-nums whitespace-nowrap"
                          style={{ fontStyle: isCarry ? "italic" : "normal", color: isCarry || isFuture ? "#A69DC0" : "#5C5378" }}>
                        {c}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visibleMetrics.map((m) => {
                  const isOpen = expanded.has(m.metricKey);
                  const view = viewFor(m, segment);
                  const sortedReps = [...view.reps].sort((a, b) => a.ranks[refIdx] - b.ranks[refIdx]);
                  const teamTotals = columns.map((_, i) => view.reps.reduce((sum, r) => sum + r.values[i], 0));
                  return (
                    <Fragment key={m.metricKey}>
                      {/* Parent (caller) row */}
                      <tr className="border-t border-[#E2DEEC]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleExpand(m.metricKey)}
                            aria-label={`expand ${m.name} team`}
                            className="flex items-center gap-2 text-left"
                          >
                            <ChevronRight size={12} className="text-[#5C5378] transition-transform" style={{ transform: isOpen ? "rotate(90deg)" : "none" }} />
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: m.color }} />
                            <span className="text-[13px] font-semibold text-[#403770] whitespace-nowrap">{m.name}</span>
                            <span className="text-[10px] text-[#8A80A8] whitespace-nowrap">{isOpen ? "You vs. team" : "You"}</span>
                          </button>
                        </td>
                        {view.caller.ranks.map((r, i) => {
                          const isFuture = i > todayIndex;
                          const share = segActive ? (view.caller.values[i] / (m.caller.values[i] || 1)) * 100 : null;
                          return (
                            <td key={i} className="px-2.5 py-2 text-right tabular-nums" style={{ opacity: isFuture ? 0.7 : 1 }}>
                              <div className="text-[13px] font-bold text-[#403770]">#{r}</div>
                              <div className="text-[10px] text-[#8A80A8]">{fmt(view.caller.values[i])}</div>
                              {share != null && <div className="text-[10px] font-semibold" style={{ color: SEGMENT_COLORS[segment] }}>{share.toFixed(0)}%</div>}
                            </td>
                          );
                        })}
                      </tr>
                      {/* Team breakdown */}
                      {isOpen && sortedReps.map((rep) => (
                        <tr key={m.metricKey + "__" + rep.name} style={{ background: rep.isCaller ? "rgba(243,113,103,0.08)" : "#FBFAFE", boxShadow: rep.isCaller ? "inset 3px 0 0 #F37167" : "none" }}>
                          <td className="sticky left-0 z-10 py-1.5 pl-10 pr-3" style={{ background: rep.isCaller ? "rgba(254,242,241,1)" : "#F8F6FC" }}>
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white align-middle" style={{ backgroundColor: rep.isCaller ? "#F37167" : "#403770" }}>
                              {rep.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                            </span>
                            <span className="text-[12px] align-middle" style={{ fontWeight: rep.isCaller ? 700 : 500, color: rep.isCaller ? "#403770" : "#5C5378" }}>{rep.name}</span>
                            {rep.isCaller && <span className="ml-1.5 rounded-full bg-[#F37167]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#F37167]">YOU</span>}
                          </td>
                          {rep.ranks.map((r, i) => {
                            const isFuture = i > todayIndex;
                            const better = !rep.isCaller && r < view.caller.ranks[i];
                            return (
                              <td key={i} className="px-2.5 py-1.5 text-right tabular-nums" style={{ opacity: isFuture ? 0.7 : 1 }}>
                                <div className="text-[12px] font-semibold" style={{ color: rep.isCaller ? "#403770" : better ? "#F37167" : "#5C5378" }}>#{r}</div>
                                <div className="text-[9px] text-[#A69DC0]">{fmt(rep.values[i])}</div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* Team total */}
                      {isOpen && (
                        <tr style={{ background: "#F7F5FA" }}>
                          <td className="sticky left-0 z-10 py-2 pl-10 pr-3 bg-[#F7F5FA]" style={{ borderTop: "1px solid #D4CFE2", boxShadow: "inset 3px 0 0 #403770" }}>
                            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#403770] text-[9px] font-bold text-white align-middle">Σ</span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#403770]">Team total</span>
                            <span className="ml-1.5 text-[10px] text-[#8A80A8]">· {view.reps.length} reps</span>
                          </td>
                          {teamTotals.map((val, i) => (
                            <td key={i} className="px-2.5 py-2 text-right text-[12px] font-bold tabular-nums text-[#403770]" style={{ borderTop: "1px solid #D4CFE2", opacity: i > todayIndex ? 0.7 : 1 }}>
                              {fmt(val)}
                            </td>
                          ))}
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 p-5">
          <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">
            {metrics.length} metrics · 12 mo + carryover{segActive ? ` · ${segMeta.label}` : ""}
          </span>
          <button type="button" onClick={exportCsv} className="flex items-center gap-1.5 rounded-md border border-[#D4CFE2] px-3 py-1.5 text-xs font-medium text-[#5C5378] hover:bg-[#EFEDF5]">
            <Download size={13} /> Export CSV
          </button>
        </div>
      </div>
    </div>
  );
}
