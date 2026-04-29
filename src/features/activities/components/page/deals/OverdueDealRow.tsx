"use client";

// OverdueDealRow — severity-railed row for past-due open deals inside OppDrawer.
// Severity is bucketed by `daysToClose` (negative = days past close):
//   ≥ -7    → low (amber)
//   -8..-30 → med (orange)
//   < -30   → high (red)

import { AlertTriangle, ExternalLink } from "lucide-react";
import type { OpenDeal } from "@/features/shared/types/api-types";
import { formatMoney } from "./formatMoney";

interface SeverityColors {
  bg: string;
  fg: string;
  border: string;
}

function severityFor(days: number): "low" | "med" | "high" {
  // days here is `daysOverdue` — POSITIVE number of days past close.
  if (days > 30) return "high";
  if (days > 7) return "med";
  return "low";
}

const SEV_COLORS: Record<"low" | "med" | "high", SeverityColors> = {
  low: { bg: "#FDF3DC", fg: "#A17820", border: "#E8C77A" },
  med: { bg: "#FFE9CC", fg: "#8F5218", border: "#F3B26A" },
  high: { bg: "#F5D4CF", fg: "#9B3A2E", border: "#E0A39B" },
};

function fmtDateShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface OverdueDealRowProps {
  deal: OpenDeal;
}

export default function OverdueDealRow({ deal }: OverdueDealRowProps) {
  // daysToClose is signed (negative when past close). Convert to positive
  // overdue count; clamp at 0 so non-overdue deals never render negative copy.
  const overdue = Math.max(
    0,
    typeof deal.daysToClose === "number" ? -deal.daysToClose : 0
  );
  const sev = severityFor(overdue);
  const colors = SEV_COLORS[sev];

  return (
    <div
      data-severity={sev}
      className="px-5 py-3 flex items-start gap-3 border-b border-[#F7F5FA] bg-white relative"
    >
      {/* Severity rail */}
      <div
        data-testid="overdue-severity-rail"
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
        <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-[13px] font-semibold text-[#403770] truncate">
            {deal.districtName ?? deal.name ?? "Unknown district"}
          </div>
          <div className="text-[13px] font-bold tabular-nums text-[#403770] flex-shrink-0">
            {formatMoney(deal.amount)}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-[#6E6390] flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1 rounded-full text-[10px] font-bold tabular-nums tracking-wide border px-1.5 py-0.5"
              style={{
                background: colors.bg,
                color: colors.fg,
                borderColor: colors.border,
              }}
            >
              {overdue} {overdue === 1 ? "day" : "days"} overdue
            </span>
            <span className="text-[#8A80A8]">{deal.stage ?? "—"}</span>
            <span className="text-[#C2BBD4]">·</span>
            <span className="text-[#8A80A8]">
              Close {fmtDateShort(deal.closeDate)}
            </span>
          </div>
          {deal.detailsLink && (
            <a
              href={deal.detailsLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-[#544A78] border border-[#D4CFE2] hover:bg-[#F7F5FA] transition-colors duration-100 fm-focus-ring"
            >
              Update
              <ExternalLink className="w-3 h-3" strokeWidth={2} aria-hidden />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
