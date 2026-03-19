"use client";

import type { Feature, Point } from "geojson";

interface VacancyCardProps {
  feature: Feature<Point>;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  open:      { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  active:    { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  closed:    { bg: "rgba(200,80,70,0.12)", text: "#a84a42" },
  filled:    { bg: "rgba(138,128,168,0.12)", text: "#6E6390" },
  pending:   { bg: "rgba(220,180,60,0.15)", text: "#8a7230" },
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
  "Speech-Language Pathologist": { bg: "rgba(255,207,112,0.20)", text: "#8a7230" },
  "Special Education":          { bg: "rgba(255,207,112,0.20)", text: "#8a7230" },
  default:                      { bg: "rgba(255,207,112,0.15)", text: "#8a7230" },
};

function getStatusStyle(status: string | undefined) {
  if (!status) return STATUS_COLORS.open;
  return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.open;
}

function getCategoryStyle(category: string | undefined) {
  if (!category) return CATEGORY_COLORS.default;
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS.default;
}

export default function VacancyCard({ feature, onClick }: VacancyCardProps) {
  const p = feature.properties ?? {};
  const title = p.title ?? "Untitled Vacancy";
  const category = p.category ?? null;
  const status = p.status ?? null;
  const schoolName = p.schoolName ?? null;
  const daysOpen = p.daysOpen ?? null;
  const districtName = p.districtName ?? null;
  const fullmindRelevant = p.fullmindRelevant ?? false;

  const statusStyle = getStatusStyle(status);
  const categoryStyle = getCategoryStyle(category);

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

      {/* Category badge + school name */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {category && (
          <span
            className="px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[160px]"
            style={{ backgroundColor: categoryStyle.bg, color: categoryStyle.text }}
          >
            {category}
          </span>
        )}
        {fullmindRelevant && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#FFCF70]/20 text-[#8a7230]">
            FM Relevant
          </span>
        )}
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-3 mt-1.5">
        {schoolName && (
          <span className="text-xs text-[#6E6390] truncate max-w-[160px]">
            {schoolName}
          </span>
        )}
        {districtName && !schoolName && (
          <span className="text-xs text-[#8A80A8] truncate max-w-[160px]">
            {districtName}
          </span>
        )}
        {daysOpen != null && (
          <span className="text-xs text-[#8A80A8]">
            <span className="font-medium text-[#6E6390]">{daysOpen}</span> days open
          </span>
        )}
      </div>

      {/* Layer accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#FFCF70] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
