"use client";

// Format currency with optional compact mode for large numbers
export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "-";
  if (compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function formatPercent(current: number, target: number | null): string {
  if (!target || target === 0) return "-";
  const percent = (current / target) * 100;
  return `${Math.round(percent)}%`;
}

// Get default fiscal year based on current date
// If we're past June (month >= 6), we're in the next fiscal year
export function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

// Progress card shows a metric with current value, target, and progress bar
interface ProgressCardProps {
  label: string;
  current: number;
  target: number | null;
  format?: "currency" | "number";
  color: string;
}

export default function ProgressCard({ label, current, target, format = "currency", color }: ProgressCardProps) {
  const formattedCurrent = format === "currency" ? formatCurrency(current, true) : current.toLocaleString();
  const formattedTarget = format === "currency" ? formatCurrency(target, true) : (target?.toLocaleString() || "-");
  const percent = target && target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[120px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {target !== null && target !== undefined && (
          <span className="text-xs font-semibold" style={{ color }}>
            {formatPercent(current, target)}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-xl font-bold text-[#403770] leading-tight">{formattedCurrent}</div>
        <div className="text-xs text-gray-400 mt-0.5">of {formattedTarget}</div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
