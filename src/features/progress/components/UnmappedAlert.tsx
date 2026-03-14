"use client";

interface UnmappedAlertProps {
  totalRevenue: number;
  districtCount: number;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(value >= 100_000 ? 0 : 1)}k`;
  return `$${Math.round(value).toLocaleString()}`;
}

export default function UnmappedAlert({ totalRevenue, districtCount }: UnmappedAlertProps) {
  if (districtCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
      <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
      <p className="text-sm text-amber-800">
        <span className="font-semibold">{districtCount} district{districtCount !== 1 ? "s" : ""}</span>
        {" "}with{" "}
        <span className="font-semibold">{formatCompact(totalRevenue)}</span>
        {" "}in revenue {districtCount !== 1 ? "are" : "is"} not mapped to any territory plan.
        {" "}Scroll down to see details.
      </p>
    </div>
  );
}
