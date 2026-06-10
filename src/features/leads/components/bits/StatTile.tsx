// Stat strip tile — icon chip on the left, display number over a micro label.
// Tones: default (plum), warn (golden), good (success), alert (coral-red —
// also tints the card border). Pixels per the prototype StatTile
// (design_files/LeadsView.jsx).

import type { LucideIcon } from "lucide-react";

export type StatTileTone = "default" | "warn" | "good" | "alert";

const TONE_FG: Record<StatTileTone, string> = {
  default: "#403770",
  warn: "#9A7B3F",
  good: "#56792F",
  alert: "#C25A52",
};

const TONE_CHIP_BG: Record<StatTileTone, string> = {
  default: "#EFEDF5",
  warn: "#FFF7EC",
  good: "#EAF8E0",
  alert: "#FEF1F0",
};

interface StatTileProps {
  label: string;
  value: number;
  tone?: StatTileTone;
  icon: LucideIcon;
}

export default function StatTile({ label, value, tone = "default", icon: Icon }: StatTileProps) {
  const fg = TONE_FG[tone];
  return (
    <div
      className="flex min-w-0 items-center gap-[11px] rounded-[10px] bg-white px-[15px] py-[11px]"
      style={{ border: `1px solid ${tone === "alert" ? "#F7C9C5" : "#E2DEEC"}` }}
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px]"
        style={{ background: TONE_CHIP_BG[tone], color: fg }}
      >
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0">
        <div
          className="text-[19px] font-bold leading-[1.1] tabular-nums"
          style={{ color: fg }}
        >
          {value}
        </div>
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] font-semibold uppercase tracking-[0.05em] text-[#8A80A8]">
          {label}
        </div>
      </div>
    </div>
  );
}
