"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { STAGE_ACCENTS, type FunnelStage, type TargetsRow } from "@/features/home/lib/pipeline";

const fmt = (v: number) => formatCurrency(v, true);
const TARGETS_ACCENT = "#8AA891"; // sage — distinct from the plum stage ramp (pre-pipe)

interface Row {
  key: string;
  name: string;
  count: number;
  min: number;
  max: number;
  sharePct: number;
  teamMin: number;
  accent: string;
  prefix: number | null; // null = Targets pre-pipe row (not clickable to a stage)
  isPreOpp: boolean;
}

// SVG trapezoid funnel: a continuous taper from the Targets pre-pipe row down through
// the active open stages. Each row's OUTER trapezoid (tinted accent) = max budget; the
// centered INNER trapezoid (solid) = min commit. Left label = max; right cluster = your
// min commit + share-of-team % with a mini bar ticked at your overall share.
export default function StageFunnelChart({
  stages,
  targets,
  overallSharePct,
  onStageClick,
}: {
  stages: FunnelStage[];
  targets: TargetsRow;
  overallSharePct: number;
  onStageClick: (prefix: number) => void;
}) {
  const activeStages = stages.filter((s) => s.count > 0);
  const rows: Row[] = [
    { key: "targets", name: "Targets", count: targets.count, min: targets.value, max: targets.value, sharePct: targets.sharePct, teamMin: targets.teamValue, accent: TARGETS_ACCENT, prefix: null, isPreOpp: true },
    ...activeStages.map((s) => ({ key: String(s.prefix), name: s.name, count: s.count, min: s.min, max: s.max, sharePct: s.sharePct, teamMin: s.teamMin, accent: STAGE_ACCENTS[s.prefix], prefix: s.prefix, isPreOpp: false })),
  ].filter((r) => (r.isPreOpp ? r.count > 0 : true));

  // Nothing in the pipeline: render a greyed-out "ghost" funnel of all open stages
  // (so the structure is still visible) instead of collapsing to a bare message.
  if (rows.length === 0) {
    const GW = 1080, gPadL = 140, gPadR = 140, gPadY = 10, gStageH = 64;
    const gH = gPadY * 2 + stages.length * gStageH;
    const gUsable = GW - gPadL - gPadR;
    const gcx = gPadL + gUsable / 2;
    const gT_TOP = 1, gT_BOT = 0.4;
    const gWAt = (idx: number) => gUsable * (gT_TOP - (gT_TOP - gT_BOT) * (idx / stages.length));
    return (
      <div>
        <svg viewBox={`0 0 ${GW} ${gH}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
          {stages.map((s, i) => {
            const y1 = gPadY + i * gStageH, y2 = y1 + gStageH;
            const tW = gWAt(i), bW = gWAt(i + 1);
            const midY = (y1 + y2) / 2;
            const outer = `M ${gcx - tW / 2} ${y1} L ${gcx + tW / 2} ${y1} L ${gcx + bW / 2} ${y2} L ${gcx - bW / 2} ${y2} Z`;
            return (
              <g key={s.prefix}>
                <path d={outer} fill="#9A8FC0" fillOpacity={0.1} stroke="#C9C2DC" strokeWidth={1} strokeDasharray="6 4" strokeOpacity={0.6} />
                {i > 0 && <line x1={gcx - tW / 2} y1={y1} x2={gcx + tW / 2} y2={y1} stroke="#FFFFFF" strokeWidth="2" />}
                <text x={gcx} y={midY - 2} textAnchor="middle" fontSize="15" fontWeight="700" fill="#A99FC4">{s.name}</text>
                <text x={gcx} y={midY + 16} textAnchor="middle" fontSize="11" fontWeight="600" fill="#BDB4D2">0 opps</text>
              </g>
            );
          })}
        </svg>
        <p className="mt-1 text-center text-xs text-[#8A80A8]">No open pipeline yet — your stages will fill in here.</p>
      </div>
    );
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

  // The SVG uses viewBox coordinates; overlay buttons use percentage positioning
  // so they sit atop each funnel row for keyboard / click accessibility.
  const pctY = (i: number) => ((padY + i * stageH) / H) * 100;
  const rowHeightPct = (stageH / H) * 100;

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ display: "block", width: "100%", height: "auto" }} aria-hidden="true">
        {rows.map((r, i) => {
          const y1 = padY + i * stageH;
          const y2 = y1 + stageH;
          const tW = topW[i], bW = botW[i];
          const ratio = r.max > 0 ? r.min / r.max : 0;
          const iT = tW * ratio, iB = bW * ratio;
          const midY = (y1 + y2) / 2;
          const outer = `M ${cx - tW / 2} ${y1} L ${cx + tW / 2} ${y1} L ${cx + bW / 2} ${y2} L ${cx - bW / 2} ${y2} Z`;
          const inner = ratio > 0 ? `M ${cx - iT / 2} ${y1} L ${cx + iT / 2} ${y1} L ${cx + iB / 2} ${y2} L ${cx - iB / 2} ${y2} Z` : null;
          const showInverse = ratio > 0.18;
          const leftWall = cx - tW / 2, rightWall = cx + tW / 2;
          const rx = rightWall + 16;
          const above = r.sharePct > overallSharePct + 2;
          const below = r.sharePct < overallSharePct - 4;
          const shareColor = above ? "#4B8B6B" : below ? "#F37167" : "#8A80A8";
          const fillW = (r.sharePct / maxBarPct) * barW;
          const tickX = rx + (overallSharePct / maxBarPct) * barW;

          return (
            <g key={r.key}>
              <path d={outer} fill={r.accent} fillOpacity={r.isPreOpp ? 0.14 : 0.22} stroke={r.isPreOpp ? r.accent : "none"} strokeWidth={r.isPreOpp ? 1.5 : 0} strokeDasharray={r.isPreOpp ? "6 4" : undefined} strokeOpacity={r.isPreOpp ? 0.55 : 1} />
              {i > 0 && <line x1={cx - tW / 2} y1={y1} x2={cx + tW / 2} y2={y1} stroke="#FFFFFF" strokeWidth="2" />}
              {inner && <path d={inner} fill={r.accent} fillOpacity={r.isPreOpp ? 0.55 : 1} />}

              <text x={cx} y={midY - 4} textAnchor="middle" fontSize="16" fontWeight="700" fill={showInverse ? "#FFFFFF" : "#403770"} style={{ paintOrder: "stroke", stroke: showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>{r.name}</text>
              <text x={cx} y={midY + 16} textAnchor="middle" fontSize="12" fontWeight="600" fill={showInverse ? "rgba(255,255,255,0.92)" : "#5C5378"} style={{ paintOrder: "stroke", stroke: showInverse ? "transparent" : "rgba(255,255,255,0.9)", strokeWidth: 4, strokeLinejoin: "round" }}>
                {r.isPreOpp ? `${r.count} accts · pre-pipe` : `${r.count} ${r.count === 1 ? "opp" : "opps"}`}
              </text>

              {!r.isPreOpp && (
                <>
                  <text x={leftWall - 12} y={midY - 2} textAnchor="end" fontSize="11" fontWeight="600" fill="#8A80A8" style={{ letterSpacing: "0.06em" }}>MAX BUDGET</text>
                  <text x={leftWall - 12} y={midY + 13} textAnchor="end" fontSize="14" fontWeight="700" fill="#544A78" style={{ letterSpacing: "-0.01em" }}>{fmt(r.max)}</text>
                </>
              )}

              <text x={rx} y={midY - 18} textAnchor="start" fontSize="10.5" fontWeight="700" fill={r.accent} style={{ letterSpacing: "0.08em" }}>{r.isPreOpp ? "EST. VALUE · YOUR SHARE" : "MIN COMMIT · YOUR SHARE"}</text>
              <text x={rx} y={midY} textAnchor="start" fontSize="15" fontWeight="700" fill={r.accent} style={{ letterSpacing: "-0.01em" }}>{fmt(r.min)}</text>
              <text x={rx + 64} y={midY} textAnchor="start" fontSize="13" fontWeight="700" fill={shareColor}>{r.sharePct}%</text>
              {(above || below) && <text x={rx + 100} y={midY} textAnchor="start" fontSize="10.5" fontWeight="600" fill={shareColor}>{above ? "↗ above" : "↘ below"}</text>}
              <rect x={rx} y={midY + 8} width={barW} height="5" rx="2.5" fill="#D4CFE2" />
              <rect x={rx} y={midY + 8} width={fillW} height="5" rx="2.5" fill={r.accent} />
              <line x1={tickX} y1={midY + 5.5} x2={tickX} y2={midY + 15.5} stroke="#F37167" strokeWidth="1.5" strokeLinecap="round" />
              <text x={rx} y={midY + 28} textAnchor="start" fontSize="10.5" fontWeight="500" fill="#8A80A8">of {fmt(r.teamMin)} team</text>
            </g>
          );
        })}
      </svg>

      {/* Accessible HTML button overlays — one per clickable stage row. Positioned over
          each funnel band so keyboard/click events work in both real browsers and jsdom. */}
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
