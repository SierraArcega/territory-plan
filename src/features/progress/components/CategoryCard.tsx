"use client";

interface CategoryCardProps {
  label: string;
  target: number;
  actual: number;
  color: string; // hex color for the category
}

/**
 * Format a dollar amount in compact notation.
 * $1,234 → "$1.2k"  |  $123,456 → "$123k"  |  $1,234,567 → "$1.2M"
 */
function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${parseFloat((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    const k = value / 1_000;
    // Show one decimal when < 100k ($1.2k, $45.6k), whole number at 100k+ ($123k)
    return k >= 100
      ? `$${Math.round(k)}k`
      : `$${parseFloat(k.toFixed(1))}k`;
  }
  return `$${Math.round(value)}`;
}

export default function CategoryCard({
  label,
  target,
  actual,
  color,
}: CategoryCardProps) {
  const percent = target > 0 ? Math.round((actual / target) * 100) : null;
  const fill = target > 0 ? Math.min((actual / target) * 100, 100) : 0;

  return (
    <div className="relative bg-white border border-gray-200 rounded-xl overflow-hidden flex">
      {/* Left accent bar */}
      <div
        className="w-1 shrink-0 rounded-l-xl"
        style={{ backgroundColor: color }}
      />

      <div className="flex-1 p-4 flex flex-col gap-3">
        {/* Category label */}
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>

        {/* Large percentage */}
        <span className="text-2xl font-bold text-[#403770] leading-none">
          {percent !== null ? `${percent}%` : "-"}
        </span>

        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${fill}%`, backgroundColor: color }}
          />
        </div>

        {/* Actual vs target */}
        <span className="text-xs text-gray-400">
          {formatCompactCurrency(actual)} / {formatCompactCurrency(target)}
        </span>
      </div>
    </div>
  );
}
