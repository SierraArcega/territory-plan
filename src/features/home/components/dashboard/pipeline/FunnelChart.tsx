"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import type { StageGroup } from "@/features/home/lib/pipeline";

const ACCENTS = ["#C2BBD4", "#9A8FC0", "#7E72A8", "#6E5FA8", "#544A85", "#403770"];
const fmt = (v: number) => formatCurrency(v, true);

// Structural funnel: one centered trapezoid per active stage (outer band = max
// budget, inner solid = min commit). Click a stage to drill into its deals.
export default function FunnelChart({ stages, onStageClick }: { stages: StageGroup[]; onStageClick: (prefix: number) => void }) {
  const active = stages.filter((s) => s.count > 0);
  if (active.length === 0) {
    return <p className="py-8 text-center text-sm text-[#8A80A8]">No open deals to chart.</p>;
  }

  const W = 600;
  const rowH = 60;
  const padX = 120;
  const padY = 8;
  const H = padY * 2 + active.length * rowH;
  const usableW = W - padX * 2;
  const cx = W / 2;
  // Width is POSITIONAL — a true funnel that always narrows top→bottom, regardless
  // of each stage's $ (which is read from the labels + the min-inside-max fill).
  const T_TOP = 1;
  const T_BOT = 0.34;
  const wAt = (idx: number) => usableW * (T_TOP - (T_TOP - T_BOT) * (idx / active.length));
  const topW = active.map((_, i) => wAt(i));
  const botW = active.map((_, i) => wAt(i + 1));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }}>
      {active.map((s, i) => {
        const y1 = padY + i * rowH;
        const y2 = y1 + rowH;
        const tW = topW[i];
        const bW = botW[i];
        const ratio = s.max > 0 ? s.min / s.max : 0;
        const accent = ACCENTS[s.prefix];
        const outer = `M ${cx - tW / 2} ${y1} L ${cx + tW / 2} ${y1} L ${cx + bW / 2} ${y2} L ${cx - bW / 2} ${y2} Z`;
        const innerTop = tW * ratio;
        const innerBot = bW * ratio;
        const inner = ratio > 0 ? `M ${cx - innerTop / 2} ${y1} L ${cx + innerTop / 2} ${y1} L ${cx + innerBot / 2} ${y2} L ${cx - innerBot / 2} ${y2} Z` : null;
        const showInverse = ratio > 0.2;
        return (
          <g key={s.prefix} onClick={() => onStageClick(s.prefix)} style={{ cursor: "pointer" }} role="button" aria-label={`${s.name} deals`}>
            <path d={outer} fill={accent} fillOpacity={0.22} />
            {inner && <path d={inner} fill={accent} />}
            <text x={cx} y={(y1 + y2) / 2 - 3} textAnchor="middle" fontSize="13" fontWeight="700" fill={showInverse ? "#FFFFFF" : "#403770"}>{s.name}</text>
            <text x={cx} y={(y1 + y2) / 2 + 13} textAnchor="middle" fontSize="11" fontWeight="500" fill={showInverse ? "rgba(255,255,255,0.9)" : "#5C5378"}>
              {s.count} {s.count === 1 ? "opp" : "opps"}
            </text>
            {/* left: max */}
            <text x={cx - tW / 2 - 10} y={(y1 + y2) / 2 + 4} textAnchor="end" fontSize="11" fontWeight="700" fill="#8A80A8">{fmt(s.max)}</text>
            {/* right: min */}
            <text x={cx + tW / 2 + 10} y={(y1 + y2) / 2 + 4} textAnchor="start" fontSize="11" fontWeight="700" fill={accent}>{fmt(s.min)}</text>
          </g>
        );
      })}
    </svg>
  );
}
