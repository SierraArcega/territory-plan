"use client";

import { useMapStore } from "@/lib/store";
import { useQuantiles } from "@/lib/api";

// Status outline colors
const STATUS_LEGEND = [
  { label: "Customer", color: "#F37167", description: "Has closed won bookings" },
  { label: "Pipeline", color: "#6EA3BE", description: "Has open pipeline" },
  { label: "Both", color: "#403770", description: "Customer with pipeline" },
];

// Metric display names
const METRIC_LABELS: Record<string, string> = {
  sessions_revenue: "Sessions Revenue",
  sessions_take: "Sessions Take",
  sessions_count: "Session Count",
  closed_won_net_booking: "Closed Won Booking",
  net_invoicing: "Net Invoicing",
  open_pipeline: "Open Pipeline",
  open_pipeline_weighted: "Weighted Pipeline",
};

const YEAR_LABELS: Record<string, string> = {
  fy25: "FY25",
  fy26: "FY26",
  fy27: "FY27",
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export default function Legend() {
  const { metricType, fiscalYear } = useMapStore();
  const { data: quantiles, isLoading } = useQuantiles(metricType, fiscalYear);

  const metricLabel = METRIC_LABELS[metricType] || metricType;
  const yearLabel = YEAR_LABELS[fiscalYear] || fiscalYear;

  return (
    <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs z-10">
      {/* Choropleth Legend */}
      <div className="mb-4">
        <h3 className="text-sm font-bold text-[#403770] mb-2">
          {metricLabel} ({yearLabel})
        </h3>

        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : quantiles ? (
          <div className="space-y-1">
            {/* Color gradient bar */}
            <div className="flex h-4 rounded overflow-hidden">
              {quantiles.colors.map((color, i) => (
                <div
                  key={i}
                  className="flex-1"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

            {/* Break values */}
            <div className="flex justify-between text-xs text-gray-600">
              <span>$0</span>
              {quantiles.breaks.slice(1).map((breakVal, i) => (
                <span key={i}>{formatCurrency(breakVal)}</span>
              ))}
              <span>{formatCurrency(quantiles.max)}</span>
            </div>

            {/* Stats */}
            <div className="text-xs text-gray-500 mt-2">
              {quantiles.count.toLocaleString()} districts with data
            </div>
          </div>
        ) : (
          <div className="text-sm text-gray-500">No data available</div>
        )}
      </div>

      {/* Status Legend */}
      <div>
        <h3 className="text-sm font-bold text-[#403770] mb-2">
          Account Status
        </h3>
        <div className="space-y-1.5">
          {STATUS_LEGEND.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <div
                className="w-4 h-0.5 rounded"
                style={{
                  backgroundColor: item.color,
                  height: item.label === "Both" ? "3px" : "2px",
                }}
              />
              <span className="text-xs text-gray-700">{item.label}</span>
              <span className="text-xs text-gray-400 ml-auto">
                {item.description}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
