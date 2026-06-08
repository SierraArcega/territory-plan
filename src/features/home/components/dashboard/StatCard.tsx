"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { ToplineSegment, OpenPipelineDetail } from "@/features/home/lib/topline";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import SegmentLegend from "./charts/SegmentLegend";
import Sparkline from "./charts/Sparkline";
import SparklineLegend from "./charts/SparklineLegend";

interface StatCardProps {
  label: string;
  labelTooltip?: string;
  value: number;
  rank: number | null;
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
  sparkline?: SparklineData;
  priorFyLabel?: string;
  currentFyLabel?: string;
  wow?: number | null;
  pipelineDetail?: OpenPipelineDetail;
  bookingsDetail?: OpenPipelineDetail;
  onExpand?: () => void;
}

// Two-line commit-floor / budget-ceiling readout shared by the open-pipeline and
// bookings cards. `oppNoun` is the singular deal noun ("open opp" / "deal").
function MinMaxLine({ detail, oppNoun }: { detail: OpenPipelineDetail; oppNoun: string }) {
  return (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span>
        <span className="font-semibold text-[#5C5378]">{detail.oppCount}</span> {oppNoun}{detail.oppCount === 1 ? "" : "s"}
        <span className="mx-1 text-[#D4CFE2]">·</span>
        <span className="font-semibold text-[#5C5378]">{detail.accountCount}</span>{" "}
        {detail.accountCount === 1 ? "account" : "accounts"}
      </span>
      <span>
        min commit <span className="font-semibold text-[#403770]">{formatCurrency(detail.minCommit, true)}</span>
        <span className="mx-1 text-[#D4CFE2]">·</span>
        max budget <span className="font-semibold text-[#403770]">{formatCurrency(detail.maxBudget, true)}</span>
      </span>
    </div>
  );
}

// A topline financial card rendered through the shared StatCardShell: headline +
// YoY/WoW deltas, optional open-pipeline min/max line, vertical source legend,
// sparkline, and the rank pill.
export default function StatCard({
  label, labelTooltip, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel, currentFyLabel, wow, pipelineDetail, bookingsDetail, onExpand,
}: StatCardProps) {
  const yoyPct = sparkline?.yoy != null ? Math.round(sparkline.yoy * 100) : null;
  const wowPct = wow != null ? Math.round(wow * 100) : null;
  const detail = pipelineDetail && pipelineDetail.oppCount > 0 ? pipelineDetail : null;
  const wonDetail = bookingsDetail && bookingsDetail.oppCount > 0 ? bookingsDetail : null;
  const hasSparkline = !!sparkline && sparkline.current.length >= 2;
  const hasPrior = !!sparkline?.prior.some((v) => v !== 0);
  const showLegend = hasSparkline && !!currentFyLabel;
  const sparklineTip = hasPrior
    ? `Your running ${label.toLowerCase()} through the fiscal year — ${currentFyLabel} so far (solid, dot = today) vs the full ${priorFyLabel} for comparison (dashed). See whether you're ahead of or behind last year's pace.`
    : `Your running ${label.toLowerCase()} through ${currentFyLabel} (the dot marks today). No ${priorFyLabel} history to compare against yet.`;

  const minMaxLine = detail ? (
    <MinMaxLine detail={detail} oppNoun="open opp" />
  ) : wonDetail ? (
    <MinMaxLine detail={wonDetail} oppNoun="deal" />
  ) : undefined;

  return (
    <StatCardShell
      label={label}
      labelTooltip={labelTooltip}
      onExpand={onExpand}
      value={formatCurrency(value, true)}
      deltaPct={yoyPct}
      priorFyLabel={priorFyLabel}
      wowPct={wowPct}
      minMaxLine={minMaxLine}
      footerLeft={hasSparkline ? (
        <>
          <Sparkline data={sparkline!.current} priorData={sparkline!.prior} todayIndex={sparkline!.todayIndex} width={140} height={32} />
          {showLegend && (
            <SparklineLegend
              currentFyLabel={currentFyLabel!}
              priorFyLabel={hasPrior ? priorFyLabel : undefined}
              tip={sparklineTip}
            />
          )}
        </>
      ) : null}
      footerRight={<RankPill rank={rank} totalReps={totalReps} inRoster={inRoster} />}
    >
      {segments.length > 0 && <SegmentLegend segments={segments} format={(v) => formatCurrency(v, true)} />}
    </StatCardShell>
  );
}
