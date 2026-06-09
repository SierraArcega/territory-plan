"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatCurrency, formatPercent } from "@/features/shared/lib/format";
import { computeRange, takeRate, utilization, deferred, mergeMotionRows, type MotionRow, type RangeGeometry } from "@/features/home/lib/sched-delivered";
import type { ToplineSegment, OpenPipelineDetail } from "@/features/home/lib/topline";
import { SEGMENT_COLORS, type SegmentKey } from "@/features/home/lib/segments";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import Sparkline from "./charts/Sparkline";
import SparklineLegend from "./charts/SparklineLegend";

// Range-bar palette (locked 2026-06-08). Mirrors the Revenue/Take Utilization
// modal: plum fill, coral for the under-min / deferred treatment.
const TRACK = "#EFEDF5";
const REV = "#6E5FB0";
const FLOOR_MARK = "#1F1A33";
const OVERAGE = "#F37167";
const DEFER = "#C77";
const POP_WIDTH = 248;

interface SchedDeliveredCardProps {
  label: string;
  labelTooltip?: string;
  revenue: number;
  take: number;
  rank: number | null;
  totalReps: number;
  inRoster: boolean;
  revenueSegments: ToplineSegment[];
  takeSegments: ToplineSegment[];
  // Closed-won contract envelope (bookingsDetail): minCommit → floor, maxBudget →
  // ceiling. The same OpenPipelineDetail the Bookings card shows as text.
  detail: OpenPipelineDetail | null;
  sparkline?: SparklineData;
  priorFyLabel?: string;
  currentFyLabel?: string;
  onExpand?: () => void;
}

// The merged Sched + Delivered card, framed as the modal frames it — utilization
// of the won-contract budget: headline Util% (delivered ÷ max budget), a fill bar
// across the min→max range, then Delivered / Deferred / Take. Coral UNDER MIN when
// delivered is below the commitment floor. Hover/tap the bar for the by-motion
// split; the whole card opens its Revenue Utilization drill-in via onExpand.
export default function SchedDeliveredCard({
  label, labelTooltip, revenue, take, rank, totalReps, inRoster,
  revenueSegments, takeSegments, detail, sparkline, priorFyLabel, currentFyLabel, onExpand,
}: SchedDeliveredCardProps) {
  const minCommit = detail?.minCommit ?? 0;
  const maxBudget = detail?.maxBudget ?? 0;
  const geo = computeRange({ revenue, take, floor: minCommit, ceiling: maxBudget });
  const util = utilization(revenue, maxBudget);
  const def = deferred(revenue, maxBudget);
  const underMin = minCommit > 0 && revenue < minCommit;
  const rate = takeRate(revenue, take);
  const motions = mergeMotionRows(revenueSegments, takeSegments);

  const hasSparkline = !!sparkline && sparkline.current.length >= 2;
  const hasPrior = !!sparkline?.prior.some((v) => v !== 0);
  const showLegend = hasSparkline && !!currentFyLabel;
  const sparklineTip = hasPrior
    ? `Your running revenue through the fiscal year — ${currentFyLabel} so far (solid, dot = today) vs the full ${priorFyLabel} for comparison (dashed).`
    : `Your running revenue through ${currentFyLabel} (the dot marks today).`;

  const subLine = geo.hasRange ? (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[11px] text-[#8A80A8]">
      utilized of budget
      {underMin && (
        <span className="rounded-full bg-[#F37167]/15 px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#F37167]">UNDER MIN</span>
      )}
    </span>
  ) : undefined;

  return (
    <StatCardShell
      label={label}
      labelTooltip={labelTooltip}
      value={geo.hasRange && util != null ? formatPercent(util, 0) : "—"}
      priorFyLabel={priorFyLabel}
      minMaxLine={subLine}
      onExpand={onExpand}
      footerLeft={hasSparkline ? (
        <>
          <Sparkline data={sparkline!.current} priorData={sparkline!.prior} todayIndex={sparkline!.todayIndex} width={140} height={32} />
          {showLegend && (
            <SparklineLegend currentFyLabel={currentFyLabel!} priorFyLabel={hasPrior ? priorFyLabel : undefined} tip={sparklineTip} />
          )}
        </>
      ) : null}
      footerRight={<RankPill rank={rank} totalReps={totalReps} inRoster={inRoster} />}
    >
      {geo.hasRange ? (
        <div className="flex flex-col gap-2.5">
          <UtilBar geo={geo} minCommit={minCommit} maxBudget={maxBudget} motions={motions} totalRevenue={revenue} totalTake={take} />
          <div className="border-t border-[#F1EEFA]" />
          <div className="flex flex-col gap-1">
            <KV label="Delivered rev" value={formatCurrency(revenue, true)} />
            <KV label="Deferred" value={formatCurrency(def, true)} valueClass="text-[#C77]" />
            <KV label="Take · rate" value={`${formatCurrency(take, true)}${rate != null ? ` · ${formatPercent(rate, 0)}` : ""}`} />
          </div>
        </div>
      ) : (
        <p className="whitespace-nowrap text-[11px] text-[#8A80A8]">No won contracts yet this year.</p>
      )}
    </StatCardShell>
  );
}

function KV({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex justify-between text-[12px]">
      <span className="whitespace-nowrap text-[#8A80A8]">{label}</span>
      <span className={`whitespace-nowrap font-semibold tabular-nums ${valueClass ?? "text-[#403770]"}`}>{value}</span>
    </div>
  );
}

// The $0 → max-budget fill bar (delivered revenue) with the min-commit floor marker.
// The whole card is the click target for the drill-in modal (StatCardShell onExpand),
// so the bar only adds the by-motion popover: hover on desktop, tap on touch
// (stopPropagation so a tap reads the breakdown without also firing the card's modal).
// Portal-rendered so the dashboard's scroll/overflow containers don't clip it.
function UtilBar({
  geo, minCommit, maxBudget, motions, totalRevenue, totalTake,
}: {
  geo: RangeGeometry;
  minCommit: number;
  maxBudget: number;
  motions: MotionRow[];
  totalRevenue: number;
  totalTake: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const tipId = useId();

  const show = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const center = r.left + r.width / 2;
      const left = Math.max(8, Math.min(center - POP_WIDTH / 2, window.innerWidth - POP_WIDTH - 8));
      setPos({ top: r.bottom + 8, left });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <div className="flex flex-col gap-1.5">
      <div
        ref={ref}
        aria-describedby={open ? tipId : undefined}
        className="relative mt-1"
        onMouseEnter={show}
        onMouseLeave={hide}
        onClick={(e) => {
          e.stopPropagation();
          open ? hide() : show();
        }}
      >
        <div className="relative h-[12px] rounded-full" style={{ background: TRACK }}>
          <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${geo.revenuePct}%`, background: REV }} />
          <div className="absolute -inset-y-1 w-[2px]" style={{ left: `${geo.floorPct}%`, background: FLOOR_MARK }} />
          {geo.overage && <div className="absolute -inset-y-0.5 right-0 w-[3px] rounded" style={{ background: OVERAGE }} />}
        </div>
      </div>

      <div className="flex justify-between text-[10px] text-[#8A80A8]">
        <span className="whitespace-nowrap">$0</span>
        <span className="whitespace-nowrap">Min {formatCurrency(minCommit, true)}</span>
        <span className="whitespace-nowrap">Max {formatCurrency(maxBudget, true)}</span>
      </div>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div
          id={tipId}
          role="tooltip"
          style={{ position: "fixed", top: pos.top, left: pos.left, width: POP_WIDTH }}
          className="pointer-events-none tooltip-enter z-30 rounded-lg bg-[#403770] p-3 text-white shadow-lg"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[#C9C1E0]">By sales motion</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[9px] uppercase text-[#A99FD0]">
                <th className="pb-1 text-left font-semibold">Motion</th>
                <th className="pb-1 text-right font-semibold">Rev</th>
                <th className="pb-1 text-right font-semibold">Take</th>
              </tr>
            </thead>
            <tbody>
              {motions.map((m) => (
                <tr key={m.key}>
                  <td className="py-0.5 text-left">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: SEGMENT_COLORS[m.key as SegmentKey] ?? "#fff" }} />
                    {m.label}
                  </td>
                  <td className="py-0.5 text-right tabular-nums">{formatCurrency(m.revenue, true)}</td>
                  <td className="py-0.5 text-right tabular-nums">
                    {formatCurrency(m.take, true)}
                    {m.rate != null && <span className="ml-1 text-[#A99FD0]">{formatPercent(m.rate, 0)}</span>}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-[#5A4F8A]">
                <td className="pt-1.5 text-left font-semibold">Total</td>
                <td className="pt-1.5 text-right font-semibold tabular-nums">{formatCurrency(totalRevenue, true)}</td>
                <td className="pt-1.5 text-right font-semibold tabular-nums">{formatCurrency(totalTake, true)}</td>
              </tr>
            </tbody>
          </table>
        </div>,
        document.body,
      )}
    </div>
  );
}
