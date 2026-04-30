import { ArrowRight, CalendarClock, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OppEventKind } from "@/features/shared/types/api-types";

export interface OppKindStyle {
  /** Mid-saturation accent for icons, chip strokes, and large surfaces. */
  color: string;
  /** Pale background for chips and tinted label cells. */
  bg: string;
  /** Darker, AA-readable variant of `color` — use this for text. The pale
   *  `color` (especially yellow `progressed`) is unreadable at body sizes. */
  ink: string;
  icon: LucideIcon;
  label: string;
}

// Per-kind styling for deal events. Colors stay inline (Tailwind can't
// generate dynamic class names from runtime values), but every component
// that renders these uses currentColor + semantic sizing per project rules.
export const OPP_STYLE: Record<OppEventKind, OppKindStyle> = {
  won:        { color: "#69B34A", bg: "#EDFFE3", ink: "#2D6B4D", icon: TrendingUp,    label: "Won" },
  lost:       { color: "#c25a52", bg: "#FEF1F0", ink: "#9B3A2E", icon: TrendingDown,  label: "Lost" },
  created:    { color: "#6EA3BE", bg: "#E8F1F5", ink: "#3F5A72", icon: Plus,          label: "New" },
  progressed: { color: "#FFCF70", bg: "#FFFAF1", ink: "#9C6A1B", icon: ArrowRight,    label: "Moved" },
  closing:    { color: "#9B7BC4", bg: "#F2EBFA", ink: "#5E4691", icon: CalendarClock, label: "Closing" },
};
