"use client";

interface TrendArrowProps {
  value: number | null;
  /** "percent" for % change, "points" for point change, "ratio" for ratios */
  unit: "percent" | "points" | "ratio";
  /** true for metrics where higher = worse */
  invertColor?: boolean;
}

export default function TrendArrow({
  value,
  unit,
  invertColor = false,
}: TrendArrowProps) {
  if (value == null) return null;

  const isPositive = value > 0;
  const isNeutral = Math.abs(value) < 0.5;

  const arrow = isNeutral ? "—" : isPositive ? "↑" : "↓";

  const isGoodDirection = invertColor ? !isPositive : isPositive;
  const colorClass = isNeutral
    ? "text-[#4d7285]"
    : isGoodDirection
    ? "text-[#5f665b]"
    : "text-[#c25a52]";

  const absVal = Math.abs(value);
  let formatted: string;
  if (unit === "percent") {
    formatted = `${absVal.toFixed(1)}%`;
  } else if (unit === "points") {
    formatted = `${absVal.toFixed(1)} pts`;
  } else {
    formatted = absVal.toFixed(1);
  }

  return (
    <span className={`inline-flex items-center gap-1 text-sm font-medium ${colorClass}`}>
      <span>{arrow}</span>
      <span>{formatted} over 3 years</span>
    </span>
  );
}
