"use client";

import { useState } from "react";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";
import { formatCurrency } from "@/features/shared/lib/format";
import { STATUS_BADGE } from "./planStatusBadge";
import PlanDetailTabs from "./PlanDetailTabs";

interface PlanDetailMobileShellProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export default function PlanDetailMobileShell({
  plan,
  onClose,
  onPrev,
  onNext,
  currentIndex,
  totalCount,
}: PlanDetailMobileShellProps) {
  const [showStats, setShowStats] = useState(false);

  const statusBadge = STATUS_BADGE[plan.status] ?? STATUS_BADGE.planning;

  const totalTarget =
    (plan.renewalRollup || 0) +
    (plan.expansionRollup || 0) +
    (plan.winbackRollup || 0) +
    (plan.newBusinessRollup || 0);

  const totalActual = plan.districts.reduce(
    (sum, d) => sum + (d.actuals?.totalRevenue ?? 0),
    0
  );

  const showNav =
    (onPrev != null || onNext != null) &&
    currentIndex != null &&
    totalCount != null &&
    totalCount > 0;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Purple header bar */}
      <div
        className="shrink-0 flex items-center justify-between gap-2 px-3 py-2"
        style={{ background: "#403770" }}
      >
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ background: "rgba(255,255,255,0.15)" }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Return to Map
        </button>

        {showNav && (
          <div className="flex items-center gap-1.5 flex-1 justify-center">
            <button
              onClick={onPrev}
              disabled={!onPrev}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ background: "rgba(255,255,255,0.15)" }}
              aria-label="Previous plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-[11px] text-white/70 whitespace-nowrap tabular-nums">
              {currentIndex! + 1} of {totalCount}
            </span>
            <button
              onClick={onNext}
              disabled={!onNext}
              className="w-7 h-7 flex items-center justify-center rounded-md text-white disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ background: "rgba(255,255,255,0.15)" }}
              aria-label="Next plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          style={{ background: "rgba(255,255,255,0.15)" }}
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Summary strip */}
      <div
        className="shrink-0 px-4 py-3 border-b border-[#E2DEEC]"
        style={{ background: "linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)" }}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: plan.color || "#403770" }}
            />
            <h2 className="text-sm font-bold text-[#403770] truncate whitespace-nowrap">
              {plan.name}
            </h2>
          </div>
          <button
            onClick={() => setShowStats((s) => !s)}
            className="shrink-0 text-xs font-semibold whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#403770]/30 rounded"
            style={{ color: showStats ? "#403770" : "#8A80A8" }}
            aria-label={showStats ? "Hide stats" : "Show stats"}
            aria-expanded={showStats}
          >
            Stats {showStats ? "▴" : "▾"}
          </button>
        </div>

        <div className="flex items-center gap-2 mt-2">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#403770] text-white">
            FY{String(plan.fiscalYear).slice(-2)}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}
          >
            {plan.status}
          </span>
        </div>

        {showStats && (
          <div className="mt-3 pt-3 border-t border-[#E2DEEC]">
            <div className="grid grid-cols-3 gap-2 mb-2">
              <StatCell label="Districts" value={String(plan.districts.length)} highlight />
              <StatCell label="Total Target" value={formatCurrency(totalTarget, true)} highlight />
              <StatCell label="Revenue" value={formatCurrency(totalActual, true)} highlight />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCell label="Renewal" value={formatCurrency(plan.renewalRollup, true)} />
              <StatCell label="Expansion" value={formatCurrency(plan.expansionRollup, true)} />
              <StatCell label="New Biz" value={formatCurrency(plan.newBusinessRollup, true)} />
            </div>
          </div>
        )}
      </div>

      {/* Tabs — fills remaining height */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <PlanDetailTabs plan={plan} onClose={onClose} />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="text-center">
      <div
        className={`text-xs tabular-nums font-bold ${
          highlight ? "text-[#403770]" : "text-[#544A78]"
        }`}
      >
        {value}
      </div>
      <div className="text-[9px] text-[#8A80A8] whitespace-nowrap">{label}</div>
    </div>
  );
}
