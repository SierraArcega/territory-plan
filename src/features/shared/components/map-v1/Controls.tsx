"use client";

import { useMapStore, MetricType, FiscalYear } from "@/features/shared/lib/app-store";

const METRICS: { value: MetricType; label: string }[] = [
  { value: "net_invoicing", label: "Net Invoicing" },
  { value: "closed_won_net_booking", label: "Closed Won Booking" },
  { value: "open_pipeline", label: "Open Pipeline" },
  { value: "open_pipeline_weighted", label: "Weighted Pipeline" },
  { value: "sessions_revenue", label: "Sessions Revenue" },
  { value: "sessions_take", label: "Sessions Take" },
  { value: "sessions_count", label: "Session Count" },
];

const YEARS: { value: FiscalYear; label: string }[] = [
  { value: "fy25", label: "FY25" },
  { value: "fy26", label: "FY26" },
  { value: "fy27", label: "FY27" },
];

export default function Controls() {
  const { metricType, fiscalYear, setMetricType, setFiscalYear } = useMapStore();

  return (
    <div className="absolute top-6 left-6 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg p-4 z-10">
      <div className="space-y-4">
        {/* Metric Selector */}
        <div>
          <label className="block text-xs font-medium text-[#403770] mb-1">
            Color by
          </label>
          <select
            value={metricType}
            onChange={(e) => setMetricType(e.target.value as MetricType)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]"
          >
            {METRICS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year Selector */}
        <div>
          <label className="block text-xs font-medium text-[#403770] mb-1">
            Fiscal Year
          </label>
          <div className="flex gap-1">
            {YEARS.map((y) => (
              <button
                key={y.value}
                onClick={() => setFiscalYear(y.value)}
                className={`flex-1 px-3 py-2 text-sm rounded-md transition-colors ${
                  fiscalYear === y.value
                    ? "bg-[#403770] text-white"
                    : "bg-gray-100 text-[#403770] hover:bg-gray-200"
                }`}
              >
                {y.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
