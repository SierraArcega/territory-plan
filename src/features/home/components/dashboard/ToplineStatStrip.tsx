"use client";

import { useTopline, useSparklines } from "@/features/home/lib/queries";
import type { ToplineMetricKey } from "@/features/home/lib/topline";
import StatCard from "./StatCard";
import TargetsCard from "./TargetsCard";

// Plain-English metric definitions for the (i) tooltip — no formulas/IDs (reps,
// not engineers). Describe what's shown today (P1 headline = net booking).
const METRIC_TOOLTIPS: Record<ToplineMetricKey, string> = {
  openPipeline:
    "Open opportunities you're actively working, by net booking value. Min commit and max budget are the contractual floor and ceiling across those deals.",
  bookings: "Closed-won bookings you've landed this fiscal year.",
  revenue: "Recognized revenue — delivered as customers use their sessions, plus what's scheduled but not yet delivered.",
  take: "Your margin contribution — the share of revenue left after delivery cost, delivered plus scheduled.",
};

interface ToplineStatStripProps {
  fy: number;
}

export default function ToplineStatStrip({ fy }: ToplineStatStripProps) {
  const { data, isLoading, isError, refetch } = useTopline(fy);
  const { data: sparkData } = useSparklines(fy);
  const priorFyLabel = `FY${String(fy - 1).slice(-2)}`;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {/* Targets (card 1) owns its own query + loading/error state */}
      <TargetsCard fy={fy} />

      {/* The four financial cards from the topline endpoint */}
      {isError ? (
        <div className="col-span-2 md:col-span-2 lg:col-span-4 rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
          <p className="text-sm text-[#5C5378]">Couldn&apos;t load your topline metrics.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-2 text-sm font-medium text-[#F37167] hover:underline"
          >
            Retry
          </button>
        </div>
      ) : isLoading || !data ? (
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />
        ))
      ) : (
        data.cards.map((card) => (
          <StatCard
            key={card.metricKey}
            label={card.label}
            labelTooltip={METRIC_TOOLTIPS[card.metricKey]}
            value={card.value}
            rank={card.rank}
            totalReps={card.totalReps}
            inRoster={card.inRoster}
            segments={card.segments}
            sparkline={sparkData?.sparklines[card.metricKey]}
            priorFyLabel={priorFyLabel}
            wow={card.metricKey === "openPipeline" || card.metricKey === "bookings" ? sparkData?.wow?.[card.metricKey] : null}
            pipelineDetail={card.pipelineDetail}
          />
        ))
      )}
    </div>
  );
}
