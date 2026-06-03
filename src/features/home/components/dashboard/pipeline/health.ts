// Shared display metadata for deal health + source segment on the pipeline tab.
import { SEGMENT_DEFS, SEGMENT_COLORS, type SegmentKey } from "@/features/home/lib/segments";
import type { AgeTier } from "@/features/home/lib/pipeline";

export const TIER_STYLE: Record<AgeTier, { label: string; color: string; bg: string }> = {
  on: { label: "On track", color: "#2E7D5B", bg: "rgba(46,125,91,0.10)" },
  watch: { label: "Watch", color: "#C7A02E", bg: "rgba(199,160,46,0.12)" },
  concerning: { label: "Concerning", color: "#C77C2E", bg: "rgba(199,124,46,0.12)" },
  stale: { label: "Stale", color: "#F37167", bg: "rgba(243,113,103,0.12)" },
};

const SOURCE_LABEL = new Map(SEGMENT_DEFS.map((d) => [d.key, d.label]));

export function sourceLabel(key: SegmentKey | null): string {
  return key ? SOURCE_LABEL.get(key) ?? key : "—";
}

export function sourceColor(key: SegmentKey | null): string {
  return key ? SEGMENT_COLORS[key] : "#8A80A8";
}

// Dates are typed Date but arrive as ISO strings over JSON — accept both. Used for
// close dates and the last-updated (last stage-change) date in the opp tables.
export function fmtShortDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
