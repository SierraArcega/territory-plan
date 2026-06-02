"use client";

import { formatCurrency } from "@/features/shared/lib/format";
import { PIPELINE_STAGES, type StageHealth } from "@/features/home/lib/pipeline";

const HEALTHY_MAX = new Map(PIPELINE_STAGES.map((s) => [s.prefix, s.healthyMax]));
const STAGE_ACCENTS = ["#C2BBD4", "#9A8FC0", "#7E72A8", "#6E5FA8", "#544A85", "#403770"];
const fmt = (v: number) => formatCurrency(v, true);

// Per-stage anatomy of the open book: $ at-stake, weighted, avg age vs the stage's
// healthy ceiling (overdue = coral), stalled count, and rank vs the team.
export default function StageHealthCard({ stageHealth }: { stageHealth: StageHealth[] }) {
  const active = stageHealth.filter((s) => s.count > 0);
  const maxAtStake = Math.max(1, ...active.map((s) => s.atStake));

  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-4 flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Stage health</h3>
        <p className="text-xs text-[#8A80A8]">Where the open book sits and which stages are clogged.</p>
      </div>

      {active.length === 0 ? (
        <p className="py-6 text-center text-sm text-[#8A80A8]">No open deals this fiscal year.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[560px] w-full text-left">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8]">
                <th className="py-1.5 pr-3 font-semibold">Stage</th>
                <th className="py-1.5 pr-3 font-semibold">$ at-stake</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Count</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Weighted</th>
                <th className="py-1.5 pr-3 text-right font-semibold">Avg age</th>
                <th className="py-1.5 text-right font-semibold">Rank</th>
              </tr>
            </thead>
            <tbody>
              {active.map((s) => {
                const healthyMax = HEALTHY_MAX.get(s.prefix) ?? Infinity;
                const overdue = s.avgAge > healthyMax;
                const accent = STAGE_ACCENTS[s.prefix];
                return (
                  <tr key={s.prefix} className="border-t border-[#E2DEEC]">
                    <td className="py-2 pr-3">
                      <span className="flex items-center gap-1.5 whitespace-nowrap">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: accent }} />
                        <span className="text-[13px] font-semibold text-[#403770]">{s.name}</span>
                        <span className="text-[11px] text-[#8A80A8]">· {(s.weight * 100).toFixed(0)}% win</span>
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 rounded-full" style={{ width: `${Math.max(6, (s.atStake / maxAtStake) * 90)}px`, background: accent }} />
                        <span className="text-[11px] font-semibold tabular-nums text-[#403770]">{fmt(s.atStake)}</span>
                      </div>
                    </td>
                    <td className="py-2 pr-3 text-right text-[13px] tabular-nums text-[#5C5378]">{s.count}</td>
                    <td className="py-2 pr-3 text-right text-[13px] font-bold tabular-nums text-[#403770]">{fmt(s.weighted)}</td>
                    <td className="py-2 pr-3 text-right text-[13px] tabular-nums whitespace-nowrap" style={{ color: overdue ? "#F37167" : "#5C5378" }}>
                      {Math.round(s.avgAge)}d <span className="text-[10px] text-[#A69DC0]">/ {healthyMax}d</span>
                    </td>
                    <td className="py-2 text-right text-[12px] font-semibold tabular-nums whitespace-nowrap">
                      <span className={s.rank === 1 ? "text-[#F37167]" : "text-[#5C5378]"}>#{s.rank}</span>
                      <span className="text-[#A69DC0]">/{s.totalReps}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
