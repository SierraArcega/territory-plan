"use client";

// Format currency with proper formatting (e.g., $10,000 or $1.5M)
function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "$0";

  const absValue = Math.abs(value);

  if (absValue >= 1000000) {
    const formatted = (value / 1000000).toFixed(1);
    // Remove trailing .0
    return `$${formatted.replace(/\.0$/, "")}M`;
  }
  if (absValue >= 1000) {
    const formatted = (value / 1000).toFixed(1);
    // Remove trailing .0
    return `$${formatted.replace(/\.0$/, "")}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

// Format a number (non-currency)
function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return Math.round(value).toLocaleString();
}

// Calculate progress percentage (capped at 100 for display)
function getProgressPercent(actual: number | null | undefined, target: number | null | undefined): number {
  if (!target || target === 0 || actual === null || actual === undefined) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
}

// Get color based on progress percentage
function getProgressColor(percent: number): string {
  if (percent >= 100) return "bg-green-500";
  if (percent >= 75) return "bg-[#6EA3BE]"; // Steel blue - on track
  if (percent >= 50) return "bg-[#D4A84B]"; // Gold - needs attention
  return "bg-[#F37167]"; // Coral - behind
}

interface GoalProgressProps {
  label: string;
  actual?: number | null;
  target?: number | null;
  isCurrency?: boolean;
  showPercentage?: boolean;
}

export default function GoalProgress({
  label,
  actual,
  target,
  isCurrency = true,
  showPercentage = true,
}: GoalProgressProps) {
  const safeActual = actual ?? 0;
  const percent = getProgressPercent(safeActual, target);
  const progressColor = getProgressColor(percent);

  // Format values for display
  const actualDisplay = isCurrency ? formatCurrency(safeActual) : formatNumber(safeActual);
  const targetDisplay = target
    ? isCurrency
      ? formatCurrency(target)
      : formatNumber(target)
    : null;

  return (
    <div className="space-y-1.5">
      {/* Label row with values */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {targetDisplay ? (
            <>
              {actualDisplay}
              <span className="text-gray-400"> / </span>
              <span className="text-gray-500">{targetDisplay}</span>
              {showPercentage && (
                <span className="ml-2 text-xs font-medium text-gray-500">
                  {percent}%
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-400 italic">Not set</span>
          )}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        {target ? (
          <div
            className={`h-full ${progressColor} transition-all duration-300 rounded-full`}
            style={{ width: `${percent}%` }}
          />
        ) : (
          <div className="h-full bg-gray-200 rounded-full" />
        )}
      </div>

      {/* Status indicator for targets that are set */}
      {target && target > 0 && (
        <div className="flex items-center gap-1.5 text-xs">
          {percent >= 100 && (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span className="text-green-600 font-medium">Goal achieved!</span>
            </>
          )}
          {percent >= 75 && percent < 100 && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#6EA3BE]" />
              <span className="text-[#6EA3BE] font-medium">On track</span>
            </>
          )}
          {percent >= 50 && percent < 75 && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#D4A84B]" />
              <span className="text-[#D4A84B] font-medium">Needs attention</span>
            </>
          )}
          {percent < 50 && (
            <>
              <span className="w-2 h-2 rounded-full bg-[#F37167]" />
              <span className="text-[#F37167] font-medium">Behind target</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
