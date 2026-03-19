"use client";

import type { Feature, Point } from "geojson";

interface ActivityCardProps {
  feature: Feature<Point>;
  onClick?: () => void;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  meeting:        { bg: "rgba(110,163,190,0.18)", text: "#3d7a96" },
  call:           { bg: "rgba(110,163,190,0.14)", text: "#4d8aaa" },
  email:          { bg: "rgba(110,163,190,0.10)", text: "#5e96b4" },
  demo:           { bg: "rgba(110,163,190,0.20)", text: "#356d85" },
  presentation:   { bg: "rgba(110,163,190,0.20)", text: "#356d85" },
  site_visit:     { bg: "rgba(110,163,190,0.22)", text: "#2d6478" },
  default:        { bg: "rgba(110,163,190,0.12)", text: "#5e96b4" },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  completed:  { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  scheduled:  { bg: "rgba(110,163,190,0.15)", text: "#3d7a96" },
  cancelled:  { bg: "rgba(200,80,70,0.12)", text: "#a84a42" },
  pending:    { bg: "rgba(220,180,60,0.15)", text: "#8a7230" },
};

function getTypeStyle(type: string | undefined) {
  if (!type) return TYPE_COLORS.default;
  return TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.default;
}

function getStatusStyle(status: string | undefined) {
  if (!status) return STATUS_COLORS.scheduled;
  return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.scheduled;
}

/** Format a date string to a short readable form. */
function formatDate(dateStr: string | undefined | null): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function ActivityCard({ feature, onClick }: ActivityCardProps) {
  const p = feature.properties ?? {};
  const title = p.title ?? "Untitled Activity";
  const type = p.type ?? null;
  const status = p.status ?? null;
  const startDate = p.startDate ?? null;
  const endDate = p.endDate ?? null;
  const outcome = p.outcome ?? null;
  const districtName = p.districtName ?? null;

  const typeStyle = getTypeStyle(type);
  const statusStyle = getStatusStyle(status);

  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);
  const dateDisplay =
    startFormatted && endFormatted
      ? `${startFormatted} - ${endFormatted}`
      : startFormatted ?? endFormatted;

  return (
    <div
      className="group relative px-3 py-2.5 rounded-lg border border-[#E2DEEC] cursor-pointer transition-colors hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      onClick={onClick}
    >
      {/* Header: Title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[#544A78] truncate">{title}</h4>
        </div>
        {status && (
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {status}
          </span>
        )}
      </div>

      {/* Type chip + date range */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {type && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
            style={{ backgroundColor: typeStyle.bg, color: typeStyle.text }}
          >
            {type}
          </span>
        )}
        {dateDisplay && (
          <span className="text-[11px] text-[#8A80A8]">{dateDisplay}</span>
        )}
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-3 mt-1.5">
        {districtName && (
          <span className="text-xs text-[#8A80A8] truncate max-w-[160px]">
            {districtName}
          </span>
        )}
        {outcome && (
          <span className="text-xs text-[#6E6390] truncate max-w-[120px]">
            {outcome}
          </span>
        )}
      </div>

      {/* Layer accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#6EA3BE] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
