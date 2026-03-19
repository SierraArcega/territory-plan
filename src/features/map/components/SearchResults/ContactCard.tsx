"use client";

import type { Feature, Point } from "geojson";

interface ContactCardProps {
  feature: Feature<Point>;
  onClick?: () => void;
}

const SENIORITY_COLORS: Record<string, { bg: string; text: string }> = {
  "C-Suite":  { bg: "rgba(243,113,103,0.18)", text: "#c94a40" },
  VP:         { bg: "rgba(243,113,103,0.12)", text: "#d4655b" },
  Director:   { bg: "rgba(243,113,103,0.10)", text: "#e0827a" },
  Manager:    { bg: "rgba(138,128,168,0.12)", text: "#6E6390" },
};

function getSeniorityStyle(level: string | undefined) {
  if (!level) return { bg: "rgba(138,128,168,0.10)", text: "#8A80A8" };
  return SENIORITY_COLORS[level] ?? { bg: "rgba(138,128,168,0.10)", text: "#8A80A8" };
}

export default function ContactCard({ feature, onClick }: ContactCardProps) {
  const p = feature.properties ?? {};
  const name = p.name ?? "Unknown Contact";
  const title = p.title ?? null;
  const seniorityLevel = p.seniorityLevel ?? null;
  const persona = p.persona ?? null;
  const districtName = p.districtName ?? null;

  const seniorityStyle = getSeniorityStyle(seniorityLevel);

  return (
    <div
      className="group relative px-3 py-2.5 rounded-lg border border-[#E2DEEC] cursor-pointer transition-colors hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      onClick={onClick}
    >
      {/* Header: Name + seniority badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-[#544A78] truncate">{name}</h4>
          {title && (
            <p className="text-xs text-[#8A80A8] truncate mt-0.5">{title}</p>
          )}
        </div>
        {seniorityLevel && (
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ backgroundColor: seniorityStyle.bg, color: seniorityStyle.text }}
          >
            {seniorityLevel}
          </span>
        )}
      </div>

      {/* Detail row */}
      <div className="flex items-center gap-3 mt-1.5">
        {persona && (
          <span className="text-xs text-[#6E6390]">
            <span className="text-[#A69DC0]">Persona</span>{" "}
            <span className="font-medium">{persona}</span>
          </span>
        )}
        {districtName && (
          <span className="text-xs text-[#8A80A8] truncate max-w-[140px]">
            {districtName}
          </span>
        )}
      </div>

      {/* Layer accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#F37167] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
