"use client";

import type { TerritoryPlan } from "@/features/shared/types/api-types";

// --- Helpers ---
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  if (n === 0) return "$0";
  return `$${n.toLocaleString()}`;
}

// --- Component ---

interface FlippablePlanCardProps {
  plan: TerritoryPlan;
  variant: "compact" | "full";
  onNavigate: (planId: string) => void;
}

export default function FlippablePlanCard({ plan, variant, onNavigate }: FlippablePlanCardProps) {
  const isCompact = variant === "compact";

  const statesList = plan.states.map((s) => s.abbrev).join(", ");

  const totalTarget =
    plan.renewalRollup + plan.expansionRollup + plan.winbackRollup + plan.newBusinessRollup;
  const pctToTarget =
    totalTarget > 0 ? Math.min(Math.round((plan.pipelineTotal / totalTarget) * 100), 999) : 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(plan.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(plan.id);
        }
      }}
      className={`
        rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm
        transition-all cursor-pointer overflow-hidden flex
        focus-visible:ring-2 focus-visible:ring-plum focus:outline-none
        ${isCompact ? "p-3" : "p-4"}
      `}
    >
      {/* Left color bar */}
      <div
        className="w-[3px] rounded-full flex-shrink-0 self-stretch"
        style={{ backgroundColor: plan.color }}
      />

      {/* Content */}
      <div className={`flex-1 min-w-0 ${isCompact ? "ml-2.5" : "ml-3"}`}>
        {/* Plan name */}
        <h3
          className={`font-semibold text-[#403770] truncate ${
            isCompact ? "text-xs" : "text-sm"
          }`}
        >
          {plan.name}
        </h3>

        {/* Districts + States */}
        <p className={`text-gray-400 ${isCompact ? "text-[11px]" : "text-xs"} mt-0.5 truncate`}>
          {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
          {statesList && <span className="text-gray-300"> · {statesList}</span>}
        </p>

        {/* Progress bar */}
        {totalTarget > 0 && (
          <div className={`${isCompact ? "mt-2" : "mt-2.5"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className={`text-gray-400 ${isCompact ? "text-[10px]" : "text-[11px]"}`}>
                {formatCompact(plan.pipelineTotal)} pipeline
              </span>
              <span className={`font-semibold tabular-nums ${
                pctToTarget >= 100 ? "text-[#8AA891]" : pctToTarget >= 50 ? "text-[#403770]/70" : "text-gray-400"
              } ${isCompact ? "text-[10px]" : "text-[11px]"}`}>
                {pctToTarget}%
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  pctToTarget >= 100 ? "bg-[#8AA891]" : "bg-[#403770]/50"
                }`}
                style={{ width: `${Math.min(pctToTarget, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
