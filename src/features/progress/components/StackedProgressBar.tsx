"use client";

interface StackedProgressBarProps {
  categories: Array<{
    label: string;
    actual: number;
    color: string;
  }>;
  totalTarget: number;
}

/**
 * Format a dollar amount in compact notation (matches CategoryCard).
 * $1,234 -> "$1.2k"  |  $123,456 -> "$123k"  |  $1,234,567 -> "$1.2M"
 */
function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${parseFloat((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const k = value / 1_000;
    return k >= 100
      ? `$${Math.round(k)}k`
      : `$${parseFloat(k.toFixed(1))}k`;
  }
  return `$${Math.round(value)}`;
}

export default function StackedProgressBar({
  categories,
  totalTarget,
}: StackedProgressBarProps) {
  const totalActual = categories.reduce((sum, c) => sum + c.actual, 0);

  // When target is zero, show an empty bar
  if (totalTarget <= 0) {
    return (
      <div>
        <div className="h-8 rounded-lg bg-gray-100" />
        <div className="mt-2 flex items-center justify-end">
          <span className="text-sm font-bold text-gray-400">
            {formatCompactCurrency(totalActual)} / {formatCompactCurrency(0)}
          </span>
        </div>
      </div>
    );
  }

  // Whether the target marker should show (only when actual < target)
  const showTargetMarker = totalActual < totalTarget;
  // Position of the target marker as a percentage of bar width.
  // If actuals overflow, the bar is scaled to totalActual, so the marker
  // moves proportionally leftward.
  const barBasis = Math.max(totalActual, totalTarget);
  const targetMarkerPct = (totalTarget / barBasis) * 100;

  return (
    <div>
      {/* Bar */}
      <div className="relative h-8 rounded-lg bg-gray-100 overflow-hidden">
        {/* Stacked segments */}
        <div className="absolute inset-0 flex">
          {categories.map((cat) => {
            if (cat.actual <= 0) return null;
            const widthPct = (cat.actual / barBasis) * 100;
            return (
              <div
                key={cat.label}
                className="h-full shrink-0"
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: cat.color,
                }}
              />
            );
          })}
        </div>

        {/* Target marker — thin dashed vertical line */}
        {showTargetMarker && (
          <div
            className="absolute top-0 bottom-0 w-px border-l-2 border-dashed border-gray-400 z-10"
            style={{ left: `${targetMarkerPct}%` }}
          />
        )}
      </div>

      {/* Legend + total */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
        {/* Category legend items */}
        {categories.map((cat) => (
          <div key={cat.label} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-xs text-gray-500">
              {cat.label}
            </span>
            <span className="text-xs font-medium text-gray-700">
              {formatCompactCurrency(cat.actual)}
            </span>
          </div>
        ))}

        {/* Spacer pushes total to the right */}
        <div className="flex-1" />

        {/* Total actual / target */}
        <span className="text-sm font-bold text-[#403770]">
          {formatCompactCurrency(totalActual)} / {formatCompactCurrency(totalTarget)}
        </span>
      </div>
    </div>
  );
}
