"use client";

export type SignalLevel = "growing" | "stable" | "at_risk" | "declining";

interface SignalBadgeProps {
  trend: number | null;
  /** true for point-change metrics (graduation, absenteeism, proficiency) — halves thresholds */
  isPointChange?: boolean;
  /** true for metrics where higher = worse (absenteeism, student-teacher ratio) */
  invertDirection?: boolean;
  /** Override the auto-computed label */
  label?: string;
  /** Compact size for header strip */
  compact?: boolean;
}

const BADGE_CONFIG: Record<
  SignalLevel,
  { bg: string; text: string; label: string }
> = {
  growing: { bg: "bg-[#EDFFE3]", text: "text-[#5f665b]", label: "Growing" },
  stable: {
    bg: "bg-[#6EA3BE]/15",
    text: "text-[#4d7285]",
    label: "Stable",
  },
  at_risk: {
    bg: "bg-[#FFCF70]/20",
    text: "text-[#997c43]",
    label: "At Risk",
  },
  declining: {
    bg: "bg-[#F37167]/15",
    text: "text-[#c25a52]",
    label: "Declining",
  },
};

export function getSignalLevel(
  trend: number | null,
  isPointChange = false,
  invertDirection = false
): SignalLevel | null {
  if (trend == null) return null;
  const t = invertDirection ? -trend : trend;
  const [hi, lo] = isPointChange ? [1.5, -2.5] : [3, -5];
  if (t > hi) return "growing";
  if (t > (isPointChange ? -1.5 : -1)) return "stable";
  if (t > lo) return "at_risk";
  return "declining";
}

export default function SignalBadge({
  trend,
  isPointChange = false,
  invertDirection = false,
  label,
  compact = false,
}: SignalBadgeProps) {
  const level = getSignalLevel(trend, isPointChange, invertDirection);
  if (!level) return null;

  const config = BADGE_CONFIG[level];
  const displayLabel = label ?? config.label;
  const size = compact
    ? "px-1.5 py-0.5 text-[10px]"
    : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${config.bg} ${config.text} ${size}`}
    >
      {displayLabel}
    </span>
  );
}
