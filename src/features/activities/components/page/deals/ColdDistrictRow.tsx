"use client";

// ColdDistrictRow — snowflake-glyph row used inside OppDrawer for `kind: 'cold'`.
// Severity is bucketed by `daysSinceActivity`.

import { Snowflake } from "lucide-react";
import { formatMoney } from "./formatMoney";

export interface ColdDistrict {
  leaid: string;
  districtName: string;
  daysSinceActivity: number;
  amount: number | null;
  stage: string | null;
  mine: boolean;
}

interface SeverityColors {
  bg: string;
  fg: string;
  border: string;
}

function severityFor(days: number): "low" | "med" | "high" {
  if (days > 45) return "high";
  if (days > 28) return "med";
  return "low";
}

const SEV_COLORS: Record<"low" | "med" | "high", SeverityColors> = {
  low: { bg: "#EEF3F7", fg: "#4C6B85", border: "#C5D2DE" },
  med: { bg: "#E3ECF3", fg: "#3F5A72", border: "#A9BFD0" },
  high: { bg: "#D9E6F1", fg: "#2B4A66", border: "#8AA4BB" },
};

interface ColdDistrictRowProps {
  district: ColdDistrict;
}

export default function ColdDistrictRow({ district }: ColdDistrictRowProps) {
  const days = Math.max(0, district.daysSinceActivity ?? 0);
  const sev = severityFor(days);
  const colors = SEV_COLORS[sev];
  const districtName = district.districtName?.trim()
    ? district.districtName
    : "Unknown district";

  return (
    <div
      data-severity={sev}
      className="px-5 py-3 flex items-start gap-3 border-b border-[#F7F5FA] bg-white relative"
    >
      {/* Severity rail */}
      <div
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-sm"
        style={{ background: colors.fg }}
      />
      <div
        className="w-7 h-7 rounded-md flex-shrink-0 inline-flex items-center justify-center border"
        style={{
          background: colors.bg,
          color: colors.fg,
          borderColor: colors.border,
        }}
      >
        <Snowflake className="w-3.5 h-3.5" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-semibold text-[#403770] truncate">
            {districtName}
          </div>
          <div className="text-[13px] font-bold tabular-nums text-[#403770] flex-shrink-0">
            {formatMoney(district.amount)}
          </div>
        </div>
        <div className="mt-1 text-[11px] text-[#6E6390] flex items-center gap-2 flex-wrap">
          <span
            className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold tabular-nums tracking-wide border px-1.5 py-0.5"
            style={{
              background: colors.bg,
              color: colors.fg,
              borderColor: colors.border,
            }}
          >
            {days} {days === 1 ? "day" : "days"} no touch
          </span>
          <span className="text-[#8A80A8]">{district.stage ?? "Active"}</span>
        </div>
      </div>
    </div>
  );
}
