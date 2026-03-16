"use client";

import { useMemo, useState } from "react";
import type { District } from "../types";
import {
  SectionCard,
  Callout,
  TierBadge,
  fmtNum,
  SCORE_COLORS,
} from "./shared";
import ClaimButton from "./ClaimButton";

/** SVG donut showing 4 sub-scores as arcs with composite in the center */
function ScoreDonut({ fit, value, readiness, state, composite, size = 56 }: {
  fit: number; value: number; readiness: number; state: number; composite: number; size?: number;
}) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // 4 arcs, each representing its sub-score proportion (out of 100)
  const segments = [
    { score: fit, color: SCORE_COLORS.fit },
    { score: value, color: SCORE_COLORS.value },
    { score: readiness, color: SCORE_COLORS.readiness },
    { score: state, color: SCORE_COLORS.state },
  ];
  const total = segments.reduce((s, seg) => s + seg.score, 0);

  let offset = -circumference / 4; // start at 12 o'clock

  return (
    <svg width={size} height={size} className="shrink-0">
      {/* Background track */}
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#EFEDF5" strokeWidth={strokeWidth} />
      {/* Sub-score arcs */}
      {segments.map(({ score, color }, i) => {
        const segLen = total > 0 ? (score / total) * circumference : 0;
        const gap = 2;
        const arcLen = Math.max(0, segLen - gap);
        const el = (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLen} ${circumference - arcLen}`}
            strokeDashoffset={-offset}
            strokeLinecap="round"
          />
        );
        offset += segLen;
        return el;
      })}
      {/* Center text */}
      <text x={center} y={center + 1} textAnchor="middle" dominantBaseline="central"
        className="text-sm font-bold fill-[#544A78]" style={{ fontSize: size > 48 ? 16 : 13 }}>
        {composite}
      </text>
    </svg>
  );
}

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
      {/* Top row: district name + action bar */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#403770] truncate">{d.name}</p>
          <p className="text-xs text-[#8A80A8] truncate mt-0.5">{subtitle}</p>
        </div>
        <ClaimButton
          leaid={d.leaid}
          districtName={d.name}
          isCustomer={d.is_customer}
          owner={d.owner}
        />
      </div>

      {/* Main row: donut + badges + pills */}
      <div className="flex items-center gap-4">
        {/* Donut with composite score */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <ScoreDonut
            fit={d.fit_score}
            value={d.value_score}
            readiness={d.readiness_score}
            state={d.state_score}
            composite={d.composite_score}
          />
          <TierBadge tier={d.tier} />
        </div>

        {/* Badges + pills */}
        <div className="flex-1 min-w-0">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {d.is_customer && (
              <span className="text-[10px] font-semibold text-[#3d7a28] bg-[#F7FFF2] px-2 py-0.5 rounded-full border border-[#8AC670]">
                Customer
              </span>
            )}
            {d.fy26_fm_ek12_rev > 0 && (
              <span className="text-[10px] font-semibold text-[#3d6f84] bg-[#e8f1f5] px-2 py-0.5 rounded-full border border-[#8bb5cb]">
                FY26 {fmtNum(d.fy26_fm_ek12_rev, { dollar: true })}
              </span>
            )}
            {!d.is_customer && d.fy26_fm_ek12_rev === 0 && d.lifetime_vendor_rev > 0 && (
              <span className="text-[10px] font-medium text-[#8A80A8] bg-[#F7F5FA] px-2 py-0.5 rounded-full border border-[#E2DEEC]">
                {fmtNum(d.lifetime_vendor_rev, { dollar: true })} lifetime
              </span>
            )}
          </div>

          {/* Fact pills */}
          <div className="flex flex-wrap gap-1.5">
            {pills.map((pill) => (
              <span
                key={pill}
                className="bg-[#F7F5FA] text-[#6E6390] text-[10px] px-2 py-0.5 rounded-full border border-[#E2DEEC]"
              >
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
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
