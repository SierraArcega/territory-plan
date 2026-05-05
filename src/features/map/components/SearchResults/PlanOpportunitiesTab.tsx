"use client";

import { useState, useMemo } from "react";
import { ExternalLink } from "lucide-react";
import { usePlanOpportunities } from "@/lib/api";
import type { PlanOpportunityRow } from "@/features/shared/types/api-types";

const GRID_TEMPLATE = "minmax(200px,1.5fr) 140px 120px 110px 90px 90px 90px 100px";

function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

const STAGE_COLORS: Record<string, { bg: string; text: string }> = {
  "Closed Won": { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" },
  "Closed Lost": { bg: "bg-[#FEF2F1]", text: "text-[#9B4D46]" },
  "Stage 5": { bg: "bg-[#EBF0F7]", text: "text-[#3D5A80]" },
  "Stage 4": { bg: "bg-[#EBF0F7]", text: "text-[#3D5A80]" },
  "Stage 3": { bg: "bg-[#F0EDF5]", text: "text-[#6E6390]" },
  "Stage 2": { bg: "bg-[#F0EDF5]", text: "text-[#8A80A8]" },
  "Stage 1": { bg: "bg-[#F7F5FA]", text: "text-[#A69DC0]" },
  "Stage 0": { bg: "bg-[#F7F5FA]", text: "text-[#A69DC0]" },
};

function getStageStyle(stage: string | null) {
  if (!stage) return { bg: "bg-[#f0edf5]", text: "text-[#8A80A8]" };
  return STAGE_COLORS[stage] ?? { bg: "bg-[#f0edf5]", text: "text-[#8A80A8]" };
}

type SortColumn = "name" | "district" | "stage" | "type" | "bookings" | "revenue" | "take" | "scheduled";

interface PlanOpportunitiesTabProps {
  planId: string;
}

export default function PlanOpportunitiesTab({ planId }: PlanOpportunitiesTabProps) {
  const { data: opportunities, isLoading, error } = usePlanOpportunities(planId);
  const [sortCol, setSortCol] = useState<SortColumn>("bookings");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir(col === "name" || col === "district" || col === "stage" || col === "type" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    if (!opportunities) return [];
    const rows = [...opportunities];
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name": cmp = (a.name ?? "").localeCompare(b.name ?? ""); break;
        case "district": cmp = (a.districtName ?? "").localeCompare(b.districtName ?? ""); break;
        case "stage": cmp = (a.stage ?? "").localeCompare(b.stage ?? ""); break;
        case "type": cmp = (a.contractType ?? "").localeCompare(b.contractType ?? ""); break;
        case "bookings": cmp = a.netBookingAmount - b.netBookingAmount; break;
        case "revenue": cmp = a.totalRevenue - b.totalRevenue; break;
        case "take": cmp = a.totalTake - b.totalTake; break;
        case "scheduled": cmp = a.scheduledRevenue - b.scheduledRevenue; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [opportunities, sortCol, sortDir]);

  const totals = useMemo(() => {
    if (!opportunities) return null;
    return opportunities.reduce(
      (acc, o) => ({
        bookings: acc.bookings + o.netBookingAmount,
        revenue: acc.revenue + o.totalRevenue,
        take: acc.take + o.totalTake,
        scheduled: acc.scheduled + o.scheduledRevenue,
      }),
      { bookings: 0, revenue: 0, take: 0, scheduled: 0 }
    );
  }, [opportunities]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-2 text-xs text-[#A69DC0]">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31 31" />
          </svg>
          Loading opportunities...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 px-6 text-center">
        <div>
          <p className="text-sm font-medium text-[#F37167]">Failed to load opportunities</p>
          <p className="text-xs text-[#A69DC0] mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-10 h-10 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No opportunities</p>
        <p className="text-xs text-[#A69DC0] mt-1">
          No opportunities found for the districts in this plan&apos;s fiscal year.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-x-auto">
      {/* Table header */}
      <div className="shrink-0 border-b border-[#E2DEEC] bg-[#FAFAFE]">
        <div
          className="grid items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]"
          style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: "max-content" }}
        >
          <div className="sticky left-0 z-[1] bg-[#FAFAFE] border-r border-[#E2DEEC]">
            <ColHeader label="Name" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          </div>
          <ColHeader label="District" col="district" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <ColHeader label="Stage" col="stage" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <ColHeader label="Type" col="type" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <ColHeader label="Bookings" col="bookings" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <ColHeader label="Revenue" col="revenue" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <ColHeader label="Take" col="take" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <ColHeader label="Scheduled" col="scheduled" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sorted.map((opp) => (
          <OppRow key={opp.id} opp={opp} />
        ))}
      </div>

      {/* Footer */}
      {totals && (
        <div className="shrink-0 border-t border-[#E2DEEC] bg-[#FAFAFE]">
          <div
            className="grid items-center px-5 py-2.5 text-[11px]"
            style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: "max-content" }}
          >
            <div className="sticky left-0 z-[1] bg-[#FAFAFE] border-r border-[#E2DEEC]">
              <span className="font-medium text-[#6E6390]">
                {opportunities.length} opportunit{opportunities.length !== 1 ? "ies" : "y"}
              </span>
            </div>
            <span />
            <span />
            <span />
            <span className="text-right font-semibold text-[#403770] tabular-nums pr-2">
              {formatCurrency(totals.bookings)}
            </span>
            <span className="text-right font-semibold text-[#403770] tabular-nums pr-2">
              {formatCurrency(totals.revenue)}
            </span>
            <span className="text-right font-semibold text-[#403770] tabular-nums pr-2">
              {formatCurrency(totals.take)}
            </span>
            <span className="text-right font-semibold text-[#403770] tabular-nums pr-2">
              {formatCurrency(totals.scheduled)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function OppRow({ opp }: { opp: PlanOpportunityRow }) {
  const stageStyle = getStageStyle(opp.stage);

  return (
    <div
      className="group grid items-center px-5 py-2.5 border-b border-[#f0edf5] last:border-b-0 hover:bg-[#FAFAFE] transition-colors"
      style={{ gridTemplateColumns: GRID_TEMPLATE, minWidth: "max-content" }}
    >
      <div className="sticky left-0 z-[1] bg-white group-hover:bg-[#FAFAFE] border-r border-[#E2DEEC] pr-2 transition-colors flex items-center min-w-0">
        {opp.detailsLink ? (
          <a
            href={opp.detailsLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 min-w-0 text-xs font-medium text-[#544A78] hover:underline fm-focus-ring"
            title={opp.name ?? undefined}
          >
            <span className="truncate">{opp.name ?? "Untitled"}</span>
            <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden />
          </a>
        ) : (
          <span
            className="text-xs font-medium text-[#544A78] truncate"
            title={opp.name ?? undefined}
          >
            {opp.name ?? "Untitled"}
          </span>
        )}
      </div>
      <span className="text-[11px] text-[#8A80A8] truncate pr-2" title={opp.districtName ?? undefined}>
        {opp.districtName ?? "—"}
      </span>
      <span className="whitespace-nowrap">
        {opp.stage ? (
          <span className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-semibold ${stageStyle.bg} ${stageStyle.text}`}>
            {opp.stage}
          </span>
        ) : (
          <span className="text-[11px] text-[#C2BBD4]">—</span>
        )}
      </span>
      <span className="text-[11px] text-[#8A80A8] truncate" title={opp.contractType ?? undefined}>
        {opp.contractType ?? "—"}
      </span>
      <span className="text-xs text-[#6E6390] text-right tabular-nums pr-2">
        {formatCurrency(opp.netBookingAmount)}
      </span>
      <span className="text-xs text-[#6E6390] text-right tabular-nums pr-2">
        {formatCurrency(opp.totalRevenue)}
      </span>
      <span className="text-xs text-[#6E6390] text-right tabular-nums pr-2">
        {formatCurrency(opp.totalTake)}
      </span>
      <span className="text-xs text-[#8A80A8] text-right tabular-nums pr-2">
        {formatCurrency(opp.scheduledRevenue)}
      </span>
    </div>
  );
}

function ColHeader({
  label,
  col,
  activeCol,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortColumn;
  activeCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  align?: "left" | "right";
}) {
  const isActive = activeCol === col;
  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 hover:text-[#544A78] transition-colors ${
        align === "right" ? "justify-end pr-2" : ""
      } ${isActive ? "text-[#544A78]" : ""}`}
    >
      {label}
      {isActive && (
        <svg width="8" height="8" viewBox="0 0 8 8" className={dir === "desc" ? "rotate-180" : ""}>
          <path d="M4 2L6.5 6H1.5L4 2Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
