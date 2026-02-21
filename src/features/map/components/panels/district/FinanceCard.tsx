"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { DistrictEducationData, DistrictTrends } from "@/lib/api";
import SignalBadge from "./signals/SignalBadge";
import TrendArrow from "./signals/TrendArrow";
import QuartileContext from "./signals/QuartileContext";
import SignalCard from "./signals/SignalCard";

interface FinanceCardProps {
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}

const REVENUE_COLORS: Record<string, { hex: string; label: string }> = {
  federal: { hex: "#6EA3BE", label: "Federal" },
  state: { hex: "#48bb78", label: "State" },
  local: { hex: "#F37167", label: "Local" },
};

function formatCurrency(val: number | null): string {
  if (val == null) return "N/A";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(val);
}

export default function FinanceCard({
  educationData,
  trends,
}: FinanceCardProps) {
  const ppSpend = educationData?.expenditurePerPupil;

  const revenueData = useMemo(() => {
    if (!educationData) return [];
    return [
      { key: "federal", value: educationData.federalRevenue },
      { key: "state", value: educationData.stateRevenue },
      { key: "local", value: educationData.localRevenue },
    ].filter((d): d is { key: string; value: number } => d.value != null && d.value > 0);
  }, [educationData]);

  const totalRevenue = educationData?.totalRevenue;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      title="Financial Health"
      badge={<SignalBadge trend={trends?.expenditurePpTrend3yr ?? null} />}
      detail={
        <div className="space-y-4 pt-2">
          {revenueData.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue Sources</h4>
              <div className="flex items-center gap-4">
                <div className="w-[120px] h-[120px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={revenueData}
                        dataKey="value"
                        nameKey="key"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={2}
                      >
                        {revenueData.map((d) => (
                          <Cell key={d.key} fill={REVENUE_COLORS[d.key]?.hex ?? "#ccc"} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: number | undefined) => formatCurrency(val ?? null)}
                        labelFormatter={(label: unknown) => {
                          const key = String(label);
                          return REVENUE_COLORS[key]?.label ?? key;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 space-y-1 text-sm">
                  {revenueData.map((d) => (
                    <div key={d.key} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: REVENUE_COLORS[d.key]?.hex }} />
                      <span className="text-gray-600">{REVENUE_COLORS[d.key]?.label}</span>
                      <span className="ml-auto font-medium text-[#403770]">
                        {totalRevenue ? `${((d.value / totalRevenue) * 100).toFixed(0)}%` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {educationData?.childrenPovertyPercent != null && (
            <div className="space-y-1">
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider">Economic Context</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Child Poverty Rate</span>
                  <span className="font-medium text-[#403770]">
                    {educationData.childrenPovertyPercent.toFixed(1)}%
                  </span>
                </div>
                {educationData.medianHouseholdIncome != null && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Median Household Income</span>
                    <span className="font-medium text-[#403770]">
                      {formatCurrency(educationData.medianHouseholdIncome)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      }
    >
      <div className="space-y-1.5">
        {ppSpend != null ? (
          <>
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-bold text-[#403770]">{formatCurrency(ppSpend)}</span>
              <TrendArrow value={trends?.expenditurePpTrend3yr ?? null} unit="percent" />
            </div>
            <div className="text-xs text-gray-500">Per-pupil expenditure</div>
            <QuartileContext quartile={trends?.expenditurePpQuartileState ?? null} />
          </>
        ) : (
          <span className="text-lg text-gray-400">No finance data</span>
        )}
      </div>
    </SignalCard>
  );
}
