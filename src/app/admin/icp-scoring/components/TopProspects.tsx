"use client";

import { useMemo, useState } from "react";
import type { District } from "../types";
import {
  SectionCard,
  Callout,
  ScoreBar,
  TierBadge,
  fmtNum,
  SCORE_BAR_CLASSES,
} from "./shared";

function ProspectCard({ d }: { d: District }) {
  const cityState = [d.city, d.state].filter(Boolean).join(", ");
  const enrollmentLabel = d.enrollment != null
    ? `${fmtNum(d.enrollment, { compact: true })} enrollment`
    : null;
  const subtitle = [cityState, enrollmentLabel].filter(Boolean).join(" · ");

  // Fact pills
  const pills: string[] = [];
  if (d.frpl_rate != null) pills.push(`${d.frpl_rate.toFixed(0)}% FP`);
  if (d.enrollment != null) pills.push(`${fmtNum(d.enrollment, { compact: true })} enr`);
  if (d.enrollment_trend_3yr != null) {
    const sign = d.enrollment_trend_3yr >= 0 ? "+" : "";
    pills.push(`${d.enrollment_trend_3yr > 0 ? "Growth" : "Decline"} ${sign}${d.enrollment_trend_3yr.toFixed(1)}%`);
  }
  if (d.vendor_count > 0) pills.push(`${d.vendor_count} vendor${d.vendor_count !== 1 ? "s" : ""}`);

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] p-4 hover:border-[#C2BBD4] transition-colors duration-100">
      {/* Main row */}
      <div className="flex items-start gap-4">
        {/* Left: composite score + tier badge */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <span className="text-2xl font-bold text-[#544A78] tabular-nums leading-none">
            {d.composite_score}
          </span>
          <TierBadge tier={d.tier} />
        </div>

        {/* Center: name + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#403770] truncate">{d.name}</p>
          <p className="text-xs text-[#8A80A8] truncate mt-0.5">{subtitle}</p>
        </div>

        {/* Right: score bars */}
        <div className="flex flex-col gap-1 flex-shrink-0">
          {(
            [
              { label: "Fit", score: d.fit_score, color: SCORE_BAR_CLASSES.fit },
              { label: "Val", score: d.value_score, color: SCORE_BAR_CLASSES.value },
              { label: "Rdy", score: d.readiness_score, color: SCORE_BAR_CLASSES.readiness },
              { label: "StS", score: d.state_score, color: SCORE_BAR_CLASSES.state },
            ] as const
          ).map(({ label, score, color }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[10px] text-[#A69DC0] w-6 flex-shrink-0">{label}</span>
              <ScoreBar value={score} color={color} />
            </div>
          ))}
        </div>
      </div>

      {/* Fact pills row */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {pills.map((pill) => (
            <span
              key={pill}
              className="bg-[#F7F5FA] text-[#6E6390] text-xs px-2 py-0.5 rounded-full border border-[#E2DEEC]"
            >
              {pill}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopProspects({ data }: { data: District[] }) {
  const [showCount, setShowCount] = useState(30);

  const prospects = useMemo(
    () =>
      data
        .filter((d) => !d.is_customer)
        .sort((a, b) => b.composite_score - a.composite_score),
    [data],
  );

  return (
    <SectionCard
      title="Top Prospects"
      description="Highest-scoring non-customer districts — your call list"
    >
      <Callout accent="coral">
        These are the highest-scoring districts that are <strong className="text-[#403770]">not yet customers</strong>. They match the ICP across all four dimensions — large, high-need, majority-minority suburban/city districts in states with favorable environments. The top prospects are concentrated in <strong className="text-[#403770]">NJ, SC, TX, GA, and IL</strong>. Many already purchase from competitors, signaling proven demand for virtual instruction.
      </Callout>

      <div className="mt-4" />

      <div className="grid grid-cols-2 gap-4">
        {prospects.slice(0, showCount).map((d) => (
          <ProspectCard key={d.leaid} d={d} />
        ))}
      </div>

      {showCount < prospects.length && (
        <div className="flex justify-center mt-4">
          <button
            onClick={() => setShowCount((c) => c + 30)}
            className="text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg px-4 py-2 hover:bg-[#EFEDF5] transition-colors duration-100"
          >
            Show more
          </button>
        </div>
      )}
    </SectionCard>
  );
}
