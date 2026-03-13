"use client";

import type {
  PlanDistrictActuals,
  PlanDistrictOpportunity,
} from "@/features/shared/types/api-types";

interface DistrictPerformanceSectionProps {
  actuals: PlanDistrictActuals | null;
  opportunities: PlanDistrictOpportunity[];
  revenueTarget: number;
  goalTakeRatePercent: number | null;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `$${Math.round(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function MetricCard({
  label,
  value,
  subtext,
}: {
  label: string;
  value: string;
  subtext?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="text-lg font-semibold text-[#403770] mt-1">{value}</div>
      {subtext && <div className="text-[10px] text-gray-400 mt-1">{subtext}</div>}
    </div>
  );
}

export default function DistrictPerformanceSection({
  actuals,
  opportunities,
  revenueTarget,
  goalTakeRatePercent,
}: DistrictPerformanceSectionProps) {
  if (!actuals) {
    return (
      <div className="py-6 text-center text-sm text-gray-400">
        No opportunity data available for this fiscal year.
      </div>
    );
  }

  const takeRateDisplay = actuals.takeRate != null
    ? `${(actuals.takeRate * 100).toFixed(1)}%`
    : "-";
  const goalRateDisplay = goalTakeRatePercent != null
    ? `Goal: ${goalTakeRatePercent}%`
    : undefined;
  const yoyDisplay = actuals.yoyRevenueChange != null
    ? `${actuals.yoyRevenueChange > 0 ? "\u2191" : "\u2193"} ${Math.abs(actuals.yoyRevenueChange).toFixed(0)}% YoY`
    : undefined;

  return (
    <div>
      <h4 className="text-[11px] font-semibold text-[#403770] uppercase tracking-wide mb-3">
        Performance
      </h4>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <MetricCard
          label="Revenue vs Target"
          value={`${formatCurrency(actuals.totalRevenue)} / ${formatCurrency(revenueTarget)}`}
        />
        <MetricCard
          label="Take"
          value={formatCurrency(actuals.completedTake)}
          subtext={actuals.scheduledTake > 0 ? `+ ${formatCurrency(actuals.scheduledTake)} scheduled` : undefined}
        />
        <MetricCard label="Take Rate" value={takeRateDisplay} subtext={goalRateDisplay} />
        <MetricCard
          label="Pipeline"
          value={formatCurrency(actuals.weightedPipeline)}
          subtext={`${actuals.oppCount} open opp${actuals.oppCount !== 1 ? "s" : ""}`}
        />
        <MetricCard
          label="Invoiced / Credited"
          value={formatCurrency(actuals.invoiced)}
          subtext={actuals.credited > 0 ? `Credited: ${formatCurrency(actuals.credited)}` : undefined}
        />
        <MetricCard
          label="Prior FY Revenue"
          value={formatCurrency(actuals.priorFyRevenue)}
          subtext={yoyDisplay}
        />
      </div>

      <h4 className="text-[11px] font-semibold text-[#403770] uppercase tracking-wide mb-2">
        Opportunities ({opportunities.length})
      </h4>
      {opportunities.length === 0 ? (
        <p className="text-sm text-gray-400">No opportunities in this fiscal year.</p>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {opportunities.map((opp, idx) => (
            <div
              key={opp.id}
              className={`flex justify-between items-start px-3 py-2.5 text-sm ${
                idx < opportunities.length - 1 ? "border-b border-gray-100" : ""
              }`}
            >
              <div>
                <div className="font-medium text-gray-700">{opp.name}</div>
                <div className="text-xs text-gray-400 mt-0.5">{opp.stage}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-gray-700">{formatCurrency(opp.netBookingAmount)}</div>
                <div className="text-xs text-gray-400 mt-0.5">Take: {formatCurrency(opp.totalTake)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
