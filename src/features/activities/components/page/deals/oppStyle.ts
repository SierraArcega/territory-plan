import { ArrowRight, CalendarClock, Plus, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { OppEventKind } from "@/features/shared/types/api-types";

export interface OppKindStyle {
  color: string;
  bg: string;
  icon: LucideIcon;
  label: string;
}

// Per-kind styling for deal events. Colors stay inline (Tailwind can't
// generate dynamic class names from runtime values), but every component
// that renders these uses currentColor + semantic sizing per project rules.
export const OPP_STYLE: Record<OppEventKind, OppKindStyle> = {
  won: { color: "#69B34A", bg: "#EDFFE3", icon: TrendingUp, label: "Won" },
  lost: { color: "#c25a52", bg: "#FEF1F0", icon: TrendingDown, label: "Lost" },
  created: { color: "#6EA3BE", bg: "#E8F1F5", icon: Plus, label: "New" },
  progressed: {
    color: "#FFCF70",
    bg: "#FFFAF1",
    icon: ArrowRight,
    label: "Moved",
  },
  closing: {
    color: "#9B7BC4",
    bg: "#F2EBFA",
    icon: CalendarClock,
    label: "Closing",
  },
};
