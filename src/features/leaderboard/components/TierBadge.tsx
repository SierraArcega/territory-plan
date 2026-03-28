"use client";

import { Shield } from "lucide-react";
import { parseTierRank, formatTierLabel, TIER_COLORS } from "../lib/types";
import type { TierRank } from "../lib/types";

interface TierBadgeProps {
  tierRank: TierRank;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const SIZE_MAP = {
  sm: { icon: 14, text: "text-[10px]", gap: "gap-1", px: "px-1.5 py-0.5" },
  md: { icon: 16, text: "text-xs", gap: "gap-1.5", px: "px-2 py-1" },
  lg: { icon: 20, text: "text-sm", gap: "gap-2", px: "px-2.5 py-1.5" },
};

export default function TierBadge({ tierRank, size = "md", showLabel = true }: TierBadgeProps) {
  const { tier } = parseTierRank(tierRank);
  const colors = TIER_COLORS[tier];
  const s = SIZE_MAP[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.px} rounded-lg font-semibold`}
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <Shield size={s.icon} fill="currentColor" strokeWidth={1.5} />
      {showLabel && <span className={s.text}>{formatTierLabel(tierRank)}</span>}
    </span>
  );
}
