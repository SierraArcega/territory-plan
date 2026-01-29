"use client";

import { useMemo } from "react";
import type { FullmindData } from "@/lib/api";

interface MetricsChartProps {
  fullmindData: FullmindData;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

interface BarData {
  label: string;
  fy25: number;
  fy26: number;
}

export default function MetricsChart({ fullmindData }: MetricsChartProps) {
  // Memoize metrics array to prevent recreating on every render
  const metrics = useMemo<BarData[]>(() => [
    {
      label: "Net Invoicing",
      fy25: fullmindData.fy25NetInvoicing,
      fy26: fullmindData.fy26NetInvoicing,
    },
    {
      label: "Closed Won",
      fy25: fullmindData.fy25ClosedWonNetBooking,
      fy26: fullmindData.fy26ClosedWonNetBooking,
    },
    {
      label: "Sessions Revenue",
      fy25: fullmindData.fy25SessionsRevenue,
      fy26: fullmindData.fy26SessionsRevenue,
    },
  ], [fullmindData]);

  // Find max value for scaling (memoized)
  const maxValue = useMemo(() => Math.max(
    ...metrics.flatMap((m) => [m.fy25, m.fy26]),
    1 // Prevent division by zero
  ), [metrics]);

  return (
    <div>
      <h3 className="text-sm font-bold text-[#403770] mb-3">
        Revenue Metrics
      </h3>

      <div className="space-y-4">
        {metrics.map((metric) => {
          const fy25Width = (metric.fy25 / maxValue) * 100;
          const fy26Width = (metric.fy26 / maxValue) * 100;

          return (
            <div key={metric.label}>
              <div className="text-xs text-gray-600 mb-1">{metric.label}</div>

              {/* FY25 Bar */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-gray-500 w-10">FY25</span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#6EA3BE] transition-all duration-300"
                    style={{ width: `${fy25Width}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-16 text-right">
                  {formatCurrency(metric.fy25)}
                </span>
              </div>

              {/* FY26 Bar */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-10">FY26</span>
                <div className="flex-1 h-4 bg-gray-100 rounded overflow-hidden">
                  <div
                    className="h-full bg-[#F37167] transition-all duration-300"
                    style={{ width: `${fy26Width}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-16 text-right">
                  {formatCurrency(metric.fy26)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#6EA3BE]" />
          <span className="text-gray-600">FY25</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-[#F37167]" />
          <span className="text-gray-600">FY26</span>
        </div>
      </div>
    </div>
  );
}
