"use client";

// Format large numbers with K/M suffixes for display
function formatCompact(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Calculate progress percentage (capped at 100 for display)
function getProgressPercent(actual: number, target: number | null): number {
  if (!target || target === 0) return 0;
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
  actual: number;
  target: number | null;
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
  const percent = getProgressPercent(actual, target);
  const progressColor = getProgressColor(percent);

  // Format values for display
  const actualDisplay = isCurrency ? formatCompact(actual) : actual.toString();
  const targetDisplay = target
    ? isCurrency
      ? formatCompact(target)
      : target.toString()
    : "Not set";

  return (
    <div className="space-y-1.5">
      {/* Label row with values */}
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600">
          {actualDisplay}
          {target && (
            <>
              {" / "}
              <span className="text-gray-500">{targetDisplay}</span>
            </>
          )}
          {showPercentage && target && (
            <span className="ml-2 text-xs font-medium text-gray-500">
              {percent}%
            </span>
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
      {target && (
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
