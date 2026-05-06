"use client";

import type { PlanFeatureRow } from "@/features/map/lib/queries";

interface PlanCardProps {
  row: PlanFeatureRow;
  onClick?: () => void;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active:   { bg: "rgba(106,168,110,0.15)", text: "#5a7a61" },
  draft:    { bg: "rgba(138,128,168,0.15)", text: "#6E6390" },
  archived: { bg: "rgba(180,170,200,0.15)", text: "#8A80A8" },
};

function getStatusStyle(status: string | undefined) {
  if (!status) return STATUS_COLORS.draft;
  return STATUS_COLORS[status.toLowerCase()] ?? STATUS_COLORS.draft;
}

export default function PlanCard({ row, onClick }: PlanCardProps) {
  const p = row;
  const planName = p.planName ?? "Untitled Plan";
  const planColor = p.planColor ?? "#7B6BA4";
  const planStatus = p.planStatus ?? "";
  const districtName = p.districtName ?? null;
  const renewalTarget = p.renewalTarget;
  const expansionTarget = p.expansionTarget;

  const statusStyle = getStatusStyle(planStatus);

  return (
    <div
      className="group relative px-3 py-2.5 rounded-lg border border-[#E2DEEC] cursor-pointer transition-colors hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      onClick={onClick}
    >
      {/* Header: Plan name + status badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          <span
            className="shrink-0 w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: planColor }}
          />
          <h4 className="text-sm font-semibold text-[#544A78] truncate">
            {planName}
          </h4>
        </div>
        {planStatus && (
          <span
            className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
            style={{ backgroundColor: statusStyle.bg, color: statusStyle.text }}
          >
            {planStatus}
          </span>
        )}
      </div>

      {/* District name */}
      {districtName && (
        <p className="text-xs text-[#8A80A8] mt-1 truncate">{districtName}</p>
      )}

      {/* Metrics row */}
      <div className="flex items-center gap-3 mt-1.5">
        {renewalTarget != null && (
          <span className="text-xs text-[#6E6390]">
            <span className="text-[#A69DC0]">Renewal</span>{" "}
            <span className="font-medium">${Number(renewalTarget).toLocaleString()}</span>
          </span>
        )}
        {expansionTarget != null && (
          <span className="text-xs text-[#6E6390]">
            <span className="text-[#A69DC0]">Expansion</span>{" "}
            <span className="font-medium">${Number(expansionTarget).toLocaleString()}</span>
          </span>
        )}
      </div>

      {/* Layer accent bar */}
      <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-[#7B6BA4] opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
