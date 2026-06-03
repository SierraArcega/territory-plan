"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { STAGE_ACCENTS, type FunnelStage, type TargetsRow } from "@/features/home/lib/pipeline";

const fmt = (v: number) => formatCurrency(v, true);
const TARGETS_ACCENT = "#8AA891"; // sage — distinct from the plum stage ramp (pre-pipe)
const WON_ACCENT = "#2E7D5B"; // green — the Closed Won outcome tip
const GHOST_FILL = "#9A8FC0";
const GHOST_STROKE = "#C9C2DC";

interface Row {
  key: string;
  name: string;
  count: number;
  min: number;
  max: number;
  sharePct: number;
  teamMin: number;
  accent: string;
  prefix: number | null; // null = non-clickable row (Targets / Closed Won / ghost)
  isPreOpp: boolean; // Targets pre-pipe row (dashed, projected)
  isWon: boolean; // Closed Won outcome tip (solid green, booked floor)
  isGhost: boolean; // greyed placeholder when there's no open pipeline
}

// SVG trapezoid funnel: a continuous taper from the Targets pre-pipe row down through
// the open stages to the Closed Won tip. Open stages show max budget (outer band) with
// the min commit (solid inner band) nested inside. When there is NO open pipeline the
// open stages render as a greyed-out ghost so the structure stays visible — and the
// Closed Won tip still shows real booked data beneath it.
export default function StageFunnelChart({
  stages,
  targets,
  won,
  overallSharePct,
  onStageClick,
}: {
  stages: FunnelStage[];
  targets: TargetsRow;
  won: FunnelStage; // Closed Won tip band (prefix 6)
  overallSharePct: number;
  onStageClick: (prefix: number) => void;
}) {
  const activeStages = stages.filter((s) => s.count > 0);
  const hasOpen = activeStages.length > 0 || targets.count > 0;

  const openRows: Row[] = hasOpen
    ? [
        { key: "targets", name: "Targets", count: targets.count, min: targets.value, max: targets.value, sharePct: targets.sharePct, teamMin: targets.teamValue, accent: TARGETS_ACCENT, prefix: null, isPreOpp: true, isWon: false, isGhost: false },
        ...activeStages.map((s) => ({ key: String(s.prefix), name: s.name, count: s.count, min: s.min, max: s.max, sharePct: s.sharePct, teamMin: s.teamMin, accent: STAGE_ACCENTS[s.prefix], prefix: s.prefix, isPreOpp: false, isWon: false, isGhost: false })),
      ].filter((r) => (r.isPreOpp ? r.count > 0 : true))
    : // No open pipeline → greyed placeholders for every open stage.
      stages.map((s) => ({ key: String(s.prefix), name: s.name, count: 0, min: 0, max: 0, sharePct: 0, teamMin: 0, accent: GHOST_FILL, prefix: null, isPreOpp: false, isWon: false, isGhost: true }));

  const wonRow: Row | null =
    won.count > 0
      ? { key: "won", name: "Closed Won", count: won.count, min: won.min, max: won.max, sharePct: won.sharePct, teamMin: won.teamMin, accent: WON_ACCENT, prefix: null, isPreOpp: false, isWon: true, isGhost: false }
      : null;

  const rows: Row[] = [...openRows, ...(wonRow ? [wonRow] : [])];
  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-[#8A80A8]">No open deals to chart.</p>;
  }

  const W = 1080, padL = 140, padR = 240, padY = 10, stageH = 82;
  const H = padY * 2 + rows.length * stageH;
  const usableW = W - padL - padR;
  const cx = padL + usableW / 2;
  // Width is POSITIONAL — a clean funnel that always narrows top→bottom, regardless
  // of each stage's $. Real budgets aren't monotonic (one big Proposal opp dwarfs the
  // rest), so $-scaled widths bulge into a diamond; the actual max/min $ is read from
  // the left/right labels + the inner (min-of-max) trapezoid ratio instead.
  const T_TOP = 1, T_BOT = 0.4;
  const wAt = (idx: number) => usableW * (T_TOP - (T_TOP - T_BOT) * (idx / rows.length));
  const topW = rows.map((_, i) => wAt(i));
  const botW = rows.map((_, i) => wAt(i + 1));
  const maxBarPct = Math.max(40, ...rows.map((r) => r.sharePct));
  const barW = 168;

  const pctY = (i: number) => ((padY + i * stageH) / H) * 100;
  const rowHeightPct = (stageH / H) * 100;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
        {rows.map((r, i) => {
          const y1 = padY + i * stageH;
          const y2 = y1 + stageH;
          const tW = topW[i], bW = botW[i];
          // Won uses a solid tip (booked floor can exceed ceiling, so no nested min/max).
          const ratio = !r.isWon && r.max > 0 ? r.min / r.max : 0;
          const iT = tW * ratio, iB = bW * ratio;
          const midY = (y1 + y2) / 2;
          const outer = `M ${cx - tW / 2} ${y1} L ${cx + tW / 2} ${y1} L ${cx + bW / 2} ${y2} L ${cx - bW / 2} ${y2} Z`;
          const inner = ratio > 0 ? `M ${cx - iT / 2} ${y1} L ${cx + iT / 2} ${y1} L ${cx + iB / 2} ${y2} L ${cx - iB / 2} ${y2} Z` : null;
          const showInverse = r.isWon || ratio > 0.18; // white centered text on a dark fill
          const leftWall = cx - tW / 2, rightWall = cx + tW / 2;
          const rx = rightWall + 16;
          const above = r.sharePct > overallSharePct + 2;
          const below = r.sharePct < overallSharePct - 4;
          const shareColor = above ? "#4B8B6B" : below ? "#F37167" : "#8A80A8";
          const fillW = (r.sharePct / maxBarPct) * barW;
          const tickX = rx + (overallSharePct / maxBarPct) * barW;

          const subtitle = r.isGhost
            ? "0 opps"
            : r.isPreOpp
            ? `${r.count} accts · pre-pipe`
            : r.isWon
            ? `${r.count} won`
            : `${r.count} ${r.count === 1 ? "opp" : "opps"}`;

          // Outer fill: ghost (faint dashed grey), pre-opp (dashed sage), won (solid
          // green), stage (tinted accent + solid inner).
          const outerOpacity = r.isGhost ? 0.1 : r.isWon ? 0.92 : r.isPreOpp ? 0.14 : 0.22;

          return (
            <g key={r.key}>
              <path
                d={outer}
                fill={r.accent}
                fillOpacity={outerOpacity}
                stroke={r.isGhost ? GHOST_STROKE : r.isPreOpp ? r.accent : "none"}
                strokeWidth={r.isGhost || r.isPreOpp ? 1.5 : 0}
                strokeDasharray={r.isGhost || r.isPreOpp ? "6 4" : undefined}
                strokeOpacity={r.isGhost ? 0.6 : r.isPreOpp ? 0.55 : 1}
              />
              {i > 0 && <line x1={cx - tW / 2} y1={y1} x2={cx + tW / 2} y2={y1} stroke="#FFFFFF" strokeWidth="2" />}
              {inner && <path d={inner} fill={r.accent} fillOpacity={1} />}

              <text x={cx} y={midY - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill={r.isGhost ? "#A99FC4" : showInverse ? "#FFFFFF" : "#403770"} style={{ paintOrder: "stroke", stroke: r.isGhost || showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>{r.name}</text>
              <text x={cx} y={midY + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill={r.isGhost ? "#BDB4D2" : showInverse ? "rgba(255,255,255,0.92)" : "#5C5378"} style={{ paintOrder: "stroke", stroke: r.isGhost || showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>
                {subtitle}
              </text>

              {!r.isPreOpp && !r.isGhost && !r.isWon && (
                <>
                  <text x={leftWall - 12} y={midY - 2} textAnchor="end" fontSize="11" fontWeight="600" fill="#8A80A8" style={{ letterSpacing: "0.06em" }}>MAX BUDGET</text>
                  <text x={leftWall - 12} y={midY + 13} textAnchor="end" fontSize="14" fontWeight="700" fill="#544A78" style={{ letterSpacing: "-0.01em" }}>{fmt(r.max)}</text>
                </>
              )}

              {!r.isGhost && (
                <>
                  <text x={rx} y={midY - 18} textAnchor="start" fontSize="10.5" fontWeight="700" fill={r.accent} style={{ letterSpacing: "0.08em" }}>{r.isPreOpp ? "EST. VALUE · YOUR SHARE" : r.isWon ? "BOOKED FLOOR · YOUR SHARE" : "MIN COMMIT · YOUR SHARE"}</text>
                  <text x={rx} y={midY} textAnchor="start" fontSize="15" fontWeight="700" fill={r.accent} style={{ letterSpacing: "-0.01em" }}>{fmt(r.min)}</text>
                  <text x={rx + 64} y={midY} textAnchor="start" fontSize="13" fontWeight="700" fill={shareColor}>{r.sharePct}%</text>
                  {(above || below) && <text x={rx + 100} y={midY} textAnchor="start" fontSize="10.5" fontWeight="600" fill={shareColor}>{above ? "↗ above" : "↘ below"}</text>}
                  <rect x={rx} y={midY + 8} width={barW} height="5" rx="2.5" fill="#D4CFE2" />
                  <rect x={rx} y={midY + 8} width={fillW} height="5" rx="2.5" fill={r.accent} />
                  <line x1={tickX} y1={midY + 5.5} x2={tickX} y2={midY + 15.5} stroke="#F37167" strokeWidth="1.5" strokeLinecap="round" />
                  <text x={rx} y={midY + 28} textAnchor="start" fontSize="10.5" fontWeight="500" fill="#8A80A8">of {fmt(r.teamMin)} team</text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {!hasOpen && (
        <p className="mt-1 text-center text-xs text-[#8A80A8]">No open pipeline yet — your stages will fill in here.</p>
      )}

      {/* Accessible HTML button overlays — one per clickable (open) stage row. */}
      {rows.map((r, i) =>
        r.prefix != null ? (
          <button
            key={r.key}
            aria-label={`${r.name} deals`}
            onClick={() => onStageClick(r.prefix as number)}
            style={{
              position: "absolute",
              top: `${pctY(i)}%`,
              left: 0,
              right: 0,
              height: `${rowHeightPct}%`,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ) : null
      )}
    </div>
  );
}
