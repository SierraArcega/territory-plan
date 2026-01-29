"use client";

import { useMemo, useState } from "react";
import type { FullmindData } from "@/lib/api";

interface FullmindMetricsProps {
  fullmindData: FullmindData;
}

// Format currency with K/M abbreviations for compact display
function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Metric definition with label and color
interface MetricDef {
  key: string;
  label: string;
  color: string;
}

// Define metrics in display order: Revenue, Invoicing, Closed Won, Open Pipeline
const METRICS: MetricDef[] = [
  { key: "revenue", label: "Sessions Revenue", color: "#6EA3BE" },
  { key: "invoicing", label: "Net Invoicing", color: "#48bb78" },
  { key: "closedWon", label: "Closed Won Bookings", color: "#9f7aea" },
  { key: "pipeline", label: "Open Pipeline", color: "#F37167" },
];

// Single metric bar component
function MetricBar({
  label,
  value,
  maxValue,
  color,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
}) {
  const widthPercent = maxValue > 0 ? (value / maxValue) * 100 : 0;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 w-28 truncate">{label}</span>
      <div className="flex-1 h-3 bg-gray-100 rounded overflow-hidden">
        <div
          className="h-full transition-all duration-300"
          style={{ width: `${widthPercent}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-14 text-right">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

// Fiscal year section component
function FiscalYearSection({
  year,
  metrics,
  maxValue,
}: {
  year: string;
  metrics: Array<{ def: MetricDef; value: number }>;
  maxValue: number;
}) {
  // Filter out zero values
  const nonZeroMetrics = metrics.filter((m) => m.value > 0);

  if (nonZeroMetrics.length === 0) {
    return null;
  }

  return (
    <div>
      <div className="text-xs font-semibold text-[#403770] mb-2">{year}</div>
      <div className="space-y-1.5">
        {nonZeroMetrics.map((metric) => (
          <MetricBar
            key={metric.def.key}
            label={metric.def.label}
            value={metric.value}
            maxValue={maxValue}
            color={metric.def.color}
          />
        ))}
      </div>
    </div>
  );
}

export default function FullmindMetrics({ fullmindData }: FullmindMetricsProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // Build data for each fiscal year
  const fyData = useMemo(() => {
    return {
      fy25: [
        { def: METRICS[0], value: Number(fullmindData.fy25SessionsRevenue) },
        { def: METRICS[1], value: Number(fullmindData.fy25NetInvoicing) },
        { def: METRICS[2], value: Number(fullmindData.fy25ClosedWonNetBooking) },
      ],
      fy26: [
        { def: METRICS[0], value: Number(fullmindData.fy26SessionsRevenue) },
        { def: METRICS[1], value: Number(fullmindData.fy26NetInvoicing) },
        { def: METRICS[2], value: Number(fullmindData.fy26ClosedWonNetBooking) },
        { def: METRICS[3], value: Number(fullmindData.fy26OpenPipeline) },
      ],
      fy27: [
        { def: METRICS[3], value: Number(fullmindData.fy27OpenPipeline) },
      ],
    };
  }, [fullmindData]);

  // Calculate max value across all metrics for consistent scaling
  const maxValue = useMemo(() => {
    const allValues = [
      ...fyData.fy25.map((m) => m.value),
      ...fyData.fy26.map((m) => m.value),
      ...fyData.fy27.map((m) => m.value),
    ];
    return Math.max(...allValues, 1);
  }, [fyData]);

  // Check if there's any data to show
  const hasAnyData = useMemo(() => {
    return (
      fyData.fy25.some((m) => m.value > 0) ||
      fyData.fy26.some((m) => m.value > 0) ||
      fyData.fy27.some((m) => m.value > 0)
    );
  }, [fyData]);

  if (!hasAnyData) {
    return null;
  }

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      {/* Collapsible Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between text-left group"
      >
        <h3 className="text-sm font-semibold text-[#403770]">Fullmind Data</h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Collapsible Content */}
      {isExpanded && (
        <div className="mt-3 space-y-4">
          <FiscalYearSection year="FY25" metrics={fyData.fy25} maxValue={maxValue} />
          <FiscalYearSection year="FY26" metrics={fyData.fy26} maxValue={maxValue} />
          <FiscalYearSection year="FY27" metrics={fyData.fy27} maxValue={maxValue} />
        </div>
      )}
    </div>
  );
}
