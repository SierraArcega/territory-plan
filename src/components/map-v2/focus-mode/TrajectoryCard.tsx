"use client";

import FocusCard from "./FocusCard";
import type { FocusModeStateData } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

interface TrajectoryCardProps {
  states: FocusModeStateData[];
  onDismiss: () => void;
}

export default function TrajectoryCard({ states, onDismiss }: TrajectoryCardProps) {
  // Aggregate across all plan states
  const totals = states.reduce(
    (acc, s) => ({
      stateFy26: acc.stateFy26 + s.state.fy26ClosedWon,
      planFy26: acc.planFy26 + s.plan.fy26ClosedWon,
      stateFy27Pipeline: acc.stateFy27Pipeline + s.state.fy27Pipeline,
      planFy27Pipeline: acc.planFy27Pipeline + s.plan.fy27Pipeline,
    }),
    { stateFy26: 0, planFy26: 0, stateFy27Pipeline: 0, planFy27Pipeline: 0 }
  );

  const fy26Pct = totals.stateFy26 > 0 ? (totals.planFy26 / totals.stateFy26) * 100 : 0;
  const fy27Pct = totals.stateFy27Pipeline > 0 ? (totals.planFy27Pipeline / totals.stateFy27Pipeline) * 100 : 0;

  return (
    <FocusCard title="FY Trajectory" onDismiss={onDismiss} className="w-[340px]">
      <div className="space-y-3">
        {/* FY26 Bookings */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-500">FY26 Bookings</span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatCurrency(totals.planFy26)}
              <span className="text-gray-300"> / {formatCurrency(totals.stateFy26)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-plum transition-all duration-500"
                style={{ width: `${Math.min(fy26Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-plum tabular-nums w-8 text-right">
              {Math.round(fy26Pct)}%
            </span>
          </div>
        </div>

        {/* FY27 Pipeline */}
        <div>
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[11px] font-medium text-gray-500">FY27 Pipeline</span>
            <span className="text-[10px] text-gray-400 tabular-nums">
              {formatCurrency(totals.planFy27Pipeline)}
              <span className="text-gray-300"> / {formatCurrency(totals.stateFy27Pipeline)}</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-coral transition-all duration-500"
                style={{ width: `${Math.min(fy27Pct, 100)}%` }}
              />
            </div>
            <span className="text-[10px] font-semibold text-coral tabular-nums w-8 text-right">
              {Math.round(fy27Pct)}%
            </span>
          </div>
        </div>
      </div>
    </FocusCard>
  );
}
