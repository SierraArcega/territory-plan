"use client";

import { useMapSummary } from "@/features/map/lib/useMapSummary";
import { formatCurrency, formatNumber } from "@/features/shared/lib/format";

function Skeleton() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          <div className="h-2 w-10 bg-gray-200 rounded animate-pulse" />
          <div className="h-3.5 w-14 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider leading-none">
        {label}
      </span>
      <span className="text-sm font-semibold text-gray-700 tabular-nums leading-tight mt-0.5">
        {value}
      </span>
    </div>
  );
}

export default function MapSummaryBar() {
  const { totals, isLoading, enabled } = useMapSummary();

  if (!enabled) return null;

  return (
    <div className="absolute bottom-6 left-6 z-10">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 overflow-hidden">
        {isLoading ? (
          <Skeleton />
        ) : (
          <div className="flex items-center gap-4 px-4 py-2.5 overflow-x-auto">
            <Stat label="Districts" value={formatNumber(totals.count)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Enrollment" value={formatNumber(totals.totalEnrollment)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Revenue" value={formatCurrency(totals.sessionsRevenue, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Invoiced" value={formatCurrency(totals.netInvoicing, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Bookings" value={formatCurrency(totals.closedWonBookings, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Pipeline" value={formatCurrency(totals.openPipeline, true)} />
            <div className="w-px h-6 bg-gray-200 shrink-0" />
            <Stat label="Wtd Pipeline" value={formatCurrency(totals.weightedPipeline, true)} />
          </div>
        )}
      </div>
    </div>
  );
}
