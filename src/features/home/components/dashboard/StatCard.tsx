"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { ToplineSegment, OpenPipelineDetail } from "@/features/home/lib/topline";
import type { Sparkline as SparklineData } from "@/features/home/lib/sparkline";
import StatCardShell from "./StatCardShell";
import RankPill from "./RankPill";
import SegmentLegend from "./charts/SegmentLegend";
import Sparkline from "./charts/Sparkline";

interface StatCardProps {
  label: string;
  value: number;
  rank: number;
  totalReps: number;
  inRoster: boolean;
  segments: ToplineSegment[];
  sparkline?: SparklineData;
  priorFyLabel?: string;
  wow?: number | null;
  pipelineDetail?: OpenPipelineDetail;
}

// A topline financial card rendered through the shared StatCardShell: headline +
// YoY/WoW deltas, optional open-pipeline min/max line, vertical source legend,
// sparkline, and the rank pill.
export default function StatCard({
  label, value, rank, totalReps, inRoster, segments, sparkline, priorFyLabel, wow, pipelineDetail,
}: StatCardProps) {
  const yoyPct = sparkline?.yoy != null ? Math.round(sparkline.yoy * 100) : null;
  const wowPct = wow != null ? Math.round(wow * 100) : null;
  const detail = pipelineDetail && pipelineDetail.oppCount > 0 ? pipelineDetail : null;

  const minMaxLine = detail ? (
    <div className="flex flex-col gap-0.5 whitespace-nowrap">
      <span>
        <span className="font-semibold text-[#5C5378]">{detail.oppCount}</span> open{" "}
        {detail.oppCount === 1 ? "opp" : "opps"}
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
  ) : undefined;

  return (
    <StatCardShell
      label={label}
      value={formatCurrency(value, true)}
      deltaPct={yoyPct}
      priorFyLabel={priorFyLabel}
      wowPct={wowPct}
      minMaxLine={minMaxLine}
      footerLeft={sparkline && sparkline.current.length >= 2 ? (
        <Sparkline data={sparkline.current} priorData={sparkline.prior} width={140} height={32} />
      ) : null}
      footerRight={<RankPill rank={rank} totalReps={totalReps} inRoster={inRoster} />}
    >
      {segments.length > 0 && <SegmentLegend segments={segments} format={(v) => formatCurrency(v, true)} />}
    </StatCardShell>
  );
}
