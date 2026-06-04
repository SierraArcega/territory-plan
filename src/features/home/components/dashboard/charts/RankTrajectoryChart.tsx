// Rank-trajectory line chart (SVG) — ported from the design prototype
// (Docs/Dashboard.zip · hifi-charts.jsx · RankTrajectoryChart). One line per
// metric, Y = #1 (top of team) .. #N. A Pre-FY carryover band, a today marker
// with a coral TODAY pill, and a dashed "PROJECTED" band over future months.
// Pure/presentational — data shaping lives in the card and the monthly engine.

const PLUM = "#403770";
const CORAL = "#F37167";
const MUTED = "#A69DC0";
const SECONDARY = "#8A80A8";
const BORDER_SUBTLE = "#E2DEEC";
const BORDER_DEFAULT = "#D4CFE2";
const SURFACE_RAISED = "#F7F5FA";

export interface RankSeries {
  name: string;
  color: string;
  ranks: number[];
  value?: string;
  projectedFrom?: string | null;
  ghost?: boolean;
}

interface RankTrajectoryChartProps {
  series: RankSeries[];
  months: string[];
  todayIndex?: number;
  carryover?: boolean;
  hideEndLabels?: boolean;
  height?: number;
  totalRanks?: number;
}

export default function RankTrajectoryChart({
  series,
  months,
  todayIndex,
  carryover = false,
  hideEndLabels = false,
  height = 280,
  totalRanks,
}: RankTrajectoryChartProps) {
  if (series.length === 0) return null;
  const ranksLen = series[0].ranks.length;
  // Zoom the Y-axis to the rank range actually drawn (plus a little headroom) so
  // the lines fill the chart instead of bunching at the top when the caller ranks
  // high in a large roster. `totalRanks` (active-rep count) is only an upper cap.
  const maxRank = Math.max(1, ...series.map((s) => Math.max(...s.ranks)));
  const cap = totalRanks ?? Number.POSITIVE_INFINITY;
  const total = Math.max(4, Math.min(cap, maxRank + 1));
  // Gridlines: the design's 1·3·6·9·12 rhythm for small ranges, anchored at the
  // bottom; evenly-spaced quartiles for large rosters (e.g. the modal's full team).
  const gridRanks =
    total <= 12
      ? [...new Set([...[1, 3, 6, 9, 12].filter((r) => r <= total), total])].sort((a, b) => a - b)
      : [1, Math.round(total * 0.25), Math.round(total * 0.5), Math.round(total * 0.75), total];
  const w = 1100;
  const padL = 56;
  const padT = 24;
  const padB = 36;
  const padR = hideEndLabels ? 64 : 220;
  const carryColW = carryover ? 90 : 0;
  const carryGap = carryover ? 28 : 0;
  const inYearStart = padL + carryColW + carryGap;
  const inYearMonths = carryover ? ranksLen - 1 : ranksLen;
  const xAt = (i: number) => {
    if (carryover && i === 0) return padL + carryColW / 2;
    const j = carryover ? i - 1 : i;
    return inYearStart + (j / (inYearMonths - 1)) * (w - inYearStart - padR);
  };
  const yAt = (r: number) => padT + ((r - 1) / (total - 1)) * (height - padT - padB);
  const carryX0 = padL;
  const carryX1 = padL + carryColW;
  const dividerX = padL + carryColW + carryGap / 2;
  const isProjectedView = todayIndex != null && todayIndex < ranksLen - 1;

  // End-of-line labels: sort by chart y, push down on collision.
  const endPositions = series
    .filter((s) => !s.ghost)
    .map((s) => ({
      name: s.name,
      r: s.ranks[s.ranks.length - 1],
      color: s.color,
      nowR: todayIndex != null ? s.ranks[todayIndex] : null,
      projectedFrom: s.projectedFrom,
      dotY: 0,
      labelY: 0,
    }));
  endPositions.sort((a, b) => a.r - b.r);
  const labelGap = isProjectedView ? 30 : 18;
  let lastLabelY = -Infinity;
  for (const p of endPositions) {
    const ideal = yAt(p.r);
    p.dotY = ideal;
    p.labelY = Math.max(ideal, lastLabelY + labelGap);
    lastLabelY = p.labelY;
  }

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} style={{ display: "block" }}>
      {/* Pre-FY carryover band */}
      {carryover && (
        <g>
          <defs>
            <pattern id="carry-hatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="6" stroke={BORDER_SUBTLE} strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={carryX0} y={padT} width={carryX1 - carryX0} height={height - padT - padB} fill="url(#carry-hatch)" opacity="0.55" rx="2" />
          <rect x={carryX0} y={padT} width={carryX1 - carryX0} height={height - padT - padB} fill={SECONDARY} opacity="0.04" rx="2" />
          <line x1={dividerX} y1={padT} x2={dividerX} y2={height - padB} stroke={BORDER_DEFAULT} strokeWidth="1" strokeDasharray="2 3" />
        </g>
      )}

      {/* gridlines + y-axis labels */}
      {gridRanks.map((r) => (
        <g key={r}>
          <line x1={padL} y1={yAt(r)} x2={w - padR} y2={yAt(r)} stroke={BORDER_SUBTLE} strokeWidth="1" opacity={r === 1 ? 0.9 : 0.55} />
          <text x={padL - 10} y={yAt(r) + 4} textAnchor="end" fontSize="11" fill={SECONDARY} fontWeight="500">#{r}</text>
        </g>
      ))}
      <text x={padL - 10} y={padT - 8} textAnchor="end" fontSize="10" fill={MUTED} fontWeight="600" letterSpacing="0.08em">TOP</text>

      {/* Scheduled / projected band over future months */}
      {isProjectedView && (
        <g>
          <defs>
            <pattern id="proj-hatch" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke={SECONDARY} strokeWidth="0.6" opacity="0.18" />
            </pattern>
          </defs>
          <rect x={xAt(todayIndex!)} y={padT} width={xAt(ranksLen - 1) - xAt(todayIndex!)} height={height - padT - padB} fill={SECONDARY} opacity="0.05" />
          <rect x={xAt(todayIndex!)} y={padT} width={xAt(ranksLen - 1) - xAt(todayIndex!)} height={height - padT - padB} fill="url(#proj-hatch)" />
          <g transform={`translate(${(xAt(todayIndex!) + xAt(ranksLen - 1)) / 2}, ${padT - 8})`}>
            <rect x="-44" y="-9" width="88" height="14" rx="3" fill={SURFACE_RAISED} stroke={BORDER_DEFAULT} strokeWidth="1" />
            <text x="0" y="1" textAnchor="middle" fontSize="9" fill={SECONDARY} fontWeight="700" letterSpacing="0.14em">PROJECTED</text>
          </g>
        </g>
      )}

      {/* x-axis */}
      <line x1={padL} y1={height - padB} x2={w - padR} y2={height - padB} stroke={BORDER_DEFAULT} strokeWidth="1" />
      {months.map((m, i) => {
        const isCarry = carryover && i === 0;
        const isFuture = todayIndex != null && i > todayIndex;
        return (
          <text key={m + i} x={xAt(i)} y={height - padB + 16} textAnchor="middle" fontSize="11"
                fill={isCarry || isFuture ? MUTED : SECONDARY}
                fontWeight={isCarry ? 600 : 500}
                fontStyle={isCarry ? "italic" : "normal"}>
            {m}
          </text>
        );
      })}

      {/* Today marker */}
      {todayIndex != null && (
        <g>
          <line x1={xAt(todayIndex)} y1={padT - 4} x2={xAt(todayIndex)} y2={height - padB} stroke={CORAL} strokeWidth="1" opacity="0.55" />
          <g transform={`translate(${xAt(todayIndex)}, ${padT - 10})`}>
            <rect x="-22" y="-9" width="44" height="14" rx="7" fill={CORAL} />
            <text x="0" y="1" textAnchor="middle" fontSize="9" fill="white" fontWeight="700" letterSpacing="0.1em">TODAY</text>
          </g>
        </g>
      )}

      {/* series */}
      {series.map((s, sIdx) => {
        const carryEnd = carryover ? 1 : 0;
        const carryPts = carryover
          ? s.ranks.slice(0, 2).map((r, i) => `${xAt(i).toFixed(1)},${yAt(r).toFixed(1)}`).join(" ")
          : "";
        const splitAt = todayIndex != null ? todayIndex : ranksLen - 1;
        const deliveredPts = s.ranks.slice(carryEnd, splitAt + 1)
          .map((r, i) => `${xAt(i + carryEnd).toFixed(1)},${yAt(r).toFixed(1)}`).join(" ");
        const scheduledPts = isProjectedView
          ? s.ranks.slice(splitAt).map((r, i) => `${xAt(i + splitAt).toFixed(1)},${yAt(r).toFixed(1)}`).join(" ")
          : "";
        const finalR = s.ranks[ranksLen - 1];
        const isFutureEnd = isProjectedView;
        const strokeW = s.ghost ? 1.5 : 2.2;
        return (
          <g key={s.name + sIdx}>
            {carryover && (
              <polyline points={carryPts} fill="none" stroke={s.color} strokeWidth={s.ghost ? 1.3 : 2} strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
            )}
            <polyline points={deliveredPts} fill="none" stroke={s.color} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
            {scheduledPts && (
              <polyline points={scheduledPts} fill="none" stroke={s.color} strokeWidth={s.ghost ? 1.3 : 2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray="5 4" opacity="0.55" />
            )}
            {carryover && !s.ghost && (
              <circle cx={xAt(0)} cy={yAt(s.ranks[0])} r="3" fill="white" stroke={s.color} strokeWidth="1.5" opacity="0.7" />
            )}
            {!s.ghost && (
              <circle cx={xAt(ranksLen - 1)} cy={yAt(finalR)} r={isFutureEnd ? 4 : 5}
                      fill={isFutureEnd ? "white" : s.color} stroke={s.color} strokeWidth={isFutureEnd ? 1.8 : 2} />
            )}
          </g>
        );
      })}

      {/* end-of-line labels */}
      {!hideEndLabels && endPositions.map((p) => {
        const changed = p.nowR != null && p.nowR !== p.r;
        const dotX = xAt(ranksLen - 1);
        const labelX = w - padR + 14;
        const offset = Math.abs(p.labelY - p.dotY);
        return (
          <g key={p.name}>
            {offset > 1 && (
              <path d={`M ${dotX + 6} ${p.dotY} L ${labelX - 8} ${p.labelY - 4}`} fill="none" stroke={p.color} strokeWidth="1" opacity="0.45" strokeDasharray="2 2" />
            )}
            <text x={labelX} y={p.labelY - 4} fontSize="12" fill={p.color} fontWeight="700">
              {isProjectedView ? (
                <>
                  {changed && <tspan fill={MUTED} fontWeight="600">#{p.nowR}→ </tspan>}
                  #{p.r} <tspan fill={PLUM} fontWeight="600">{p.name}</tspan>
                </>
              ) : (
                <>#{p.r} <tspan fill={PLUM} fontWeight="600">{p.name}</tspan></>
              )}
            </text>
            {isProjectedView && p.projectedFrom && (
              <text x={labelX} y={p.labelY + 10} fontSize="9.5" fill={MUTED} fontWeight="500">proj · {p.projectedFrom}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
