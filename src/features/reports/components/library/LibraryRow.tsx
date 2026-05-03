"use client";

import { ChevronRight, Clock, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ReportListItem } from "../../lib/queries";
import { initials, ownerColor } from "./initials";

interface Props {
  report: ReportListItem;
  showOwner: boolean;
  isAdmin: boolean;
  /** When true, the row reveals a delete icon on hover and forwards clicks
   *  to onDelete. Caller is responsible for confirming and invalidating. */
  canDelete: boolean;
  onOpen: (id: number) => void;
  onToggleStar: (id: number, next: boolean) => void;
  onDelete: (id: number, title: string) => void;
}

const FORMATTER = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function relativeTime(iso: string | null): string {
  if (!iso) return "never run";
  const then = new Date(iso).getTime();
  const diffSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return FORMATTER.format(diffSec, "second");
  if (abs < 3600) return FORMATTER.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return FORMATTER.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return FORMATTER.format(Math.round(diffSec / 86400), "day");
  return FORMATTER.format(Math.round(diffSec / (86400 * 30)), "month");
}

export function LibraryRow({
  report,
  showOwner,
  isAdmin,
  canDelete,
  onOpen,
  onToggleStar,
  onDelete,
}: Props) {
  const [hover, setHover] = useState(false);

  const handleStarClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleStar(report.id, !report.isTeamPinned);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(report.id, report.title);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => onOpen(report.id)}
      className="flex cursor-pointer items-center gap-3.5 px-4 py-3.5 transition-colors duration-100"
      style={{ background: hover ? "#FFFCFA" : "#fff" }}
    >
      {isAdmin && (
        <button
          type="button"
          onClick={handleStarClick}
          aria-label={report.isTeamPinned ? "Unstar report" : "Star report"}
          className="shrink-0 rounded p-0.5 transition-colors hover:bg-[#F7F5FA]"
        >
          <Star
            size={16}
            className="transition-colors"
            fill={report.isTeamPinned ? "#FFCF70" : "none"}
            color={report.isTeamPinned ? "#FFCF70" : "#D4CFE2"}
          />
        </button>
      )}
      {!isAdmin && report.isTeamPinned && (
        <Star size={16} fill="#FFCF70" color="#FFCF70" className="shrink-0" />
      )}

      <div className="min-w-0 flex-1">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-semibold text-[#403770]">
          {report.title}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center text-[11.5px] text-[#8A80A8]">
          <span className="max-w-[460px] overflow-hidden text-ellipsis whitespace-nowrap text-[#6E6390]">
            {report.question}
          </span>
          <span className="mx-2 text-[#D4CFE2]">·</span>
          <span className="inline-flex items-center gap-1 whitespace-nowrap">
            <Clock size={10} /> {relativeTime(report.lastRunAt)}
          </span>
          {report.rowCount != null && (
            <>
              <span className="mx-2 text-[#D4CFE2]">·</span>
              <span className="whitespace-nowrap tabular-nums">
                {report.rowCount.toLocaleString()} rows
              </span>
            </>
          )}
        </div>
      </div>

      {showOwner && report.owner && (
        <div className="flex shrink-0 items-center gap-1.5">
          <div
            className="grid h-6 w-6 place-items-center rounded-full text-[10px] font-semibold text-white"
            style={{ background: ownerColor(report.owner.fullName) }}
          >
            {initials(report.owner.fullName)}
          </div>
          <div className="whitespace-nowrap text-[11.5px] font-medium text-[#6E6390]">
            {report.owner.fullName ?? "Unknown"}
          </div>
        </div>
      )}

      {canDelete && hover && (
        <button
          type="button"
          onClick={handleDeleteClick}
          aria-label={`Delete ${report.title}`}
          title="Delete saved report"
          className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent p-1 text-[#A69DC0] transition-colors hover:border-[#f58d85] hover:bg-[#fef1f0] hover:text-[#c25a52]"
        >
          <Trash2 size={14} />
        </button>
      )}

      <ChevronRight
        size={14}
        className="shrink-0 transition-colors"
        color={hover ? "#403770" : "#C2BBD4"}
      />
    </div>
  );
}
