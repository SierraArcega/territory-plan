"use client";

import { useState } from "react";
import type { TerritoryPlan } from "@/features/shared/types/api-types";
import ProportionalDonut from "./ProportionalDonut";

// --- Segment colors (matching brand palette) ---
const SEGMENT_COLORS = {
  renewal: "#8AA891",      // Sage
  expansion: "#6EA3BE",    // Steel Blue
  winback: "#F37167",      // Coral
  newBusiness: "#403770",  // Plum
} as const;

// --- Status badge styling (matching PlansListPanel pattern) ---
const STATUS_STYLE: Record<string, { bg: string; text: string; dot: string }> = {
  working: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  planning: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  stale: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
  archived: { bg: "bg-gray-100", text: "text-gray-500", dot: "bg-gray-400" },
};

// --- Helpers ---
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const datePart = dateString.split("T")[0];
  return new Date(datePart + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

// --- Component ---

interface FlippablePlanCardProps {
  plan: TerritoryPlan;
  variant: "compact" | "full";
  onNavigate: (planId: string) => void;
}

export default function FlippablePlanCard({ plan, variant, onNavigate }: FlippablePlanCardProps) {
  const [flipped, setFlipped] = useState(false);

  const isCompact = variant === "compact";
  const donutSize = isCompact ? 40 : 56;
  const donutStrokeWidth = isCompact ? 5 : 7;

  const segments = [
    { value: plan.renewalRollup, color: SEGMENT_COLORS.renewal, label: "Renewal" },
    { value: plan.expansionRollup, color: SEGMENT_COLORS.expansion, label: "Expansion" },
    { value: plan.winbackRollup, color: SEGMENT_COLORS.winback, label: "Win Back" },
    { value: plan.newBusinessRollup, color: SEGMENT_COLORS.newBusiness, label: "New Business" },
  ];

  const statusStyle = STATUS_STYLE[plan.status] ?? STATUS_STYLE.planning;

  const taskProgress =
    plan.taskCount > 0
      ? Math.round((plan.completedTaskCount / plan.taskCount) * 100)
      : 0;

  const dateRange =
    plan.startDate || plan.endDate
      ? `${formatDate(plan.startDate)}${plan.startDate && plan.endDate ? " - " : ""}${formatDate(plan.endDate)}`
      : null;

  const statesList = plan.states.map((s) => s.abbrev).join(", ");

  const handleCardClick = () => {
    onNavigate(plan.id);
  };

  const handleFlip = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    setFlipped((prev) => !prev);
  };

  // Shared inline styles for 3D
  const faceStyle: React.CSSProperties = {
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
  };

  const backFaceStyle: React.CSSProperties = {
    ...faceStyle,
    transform: "rotateY(180deg)",
  };

  // --- Flip icon SVG ---
  const flipIcon = (
    <button
      onClick={handleFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleFlip(e);
        }
      }}
      aria-label={flipped ? "Show plan summary" : "Show plan details"}
      className="w-6 h-6 rounded-full flex items-center justify-center text-gray-300 hover:text-plum hover:bg-gray-100 transition-all flex-shrink-0"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 16 16"
        fill="none"
        className="transition-transform hover:rotate-12"
      >
        <path
          d="M2 8.5C2 5.46 4.46 3 7.5 3H10M10 3L8 1M10 3L8 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M14 7.5C14 10.54 11.54 13 8.5 13H6M6 13L8 15M6 13L8 11"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  // --- Front Face ---
  const frontFace = (
    <div className="absolute inset-0" style={faceStyle}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`
          h-full rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm
          transition-all cursor-pointer overflow-hidden flex
          ${isCompact ? "p-3" : "p-4"}
        `}
      >
        {/* Left color bar */}
        <div
          className="w-[3px] rounded-full flex-shrink-0 self-stretch"
          style={{ backgroundColor: plan.color }}
        />

        {/* Donut */}
        <div className={`flex-shrink-0 ${isCompact ? "ml-2.5" : "ml-3"}`}>
          <ProportionalDonut
            segments={segments}
            size={donutSize}
            strokeWidth={donutStrokeWidth}
          />
        </div>

        {/* Content */}
        <div className={`flex-1 min-w-0 ${isCompact ? "ml-2.5" : "ml-3"}`}>
          <div className="flex items-start justify-between gap-1">
            <h3
              className={`font-semibold text-plum truncate ${
                isCompact ? "text-xs" : "text-sm"
              }`}
            >
              {plan.name}
            </h3>
            {flipIcon}
          </div>

          <p className={`text-gray-400 ${isCompact ? "text-[11px]" : "text-xs"} mt-0.5`}>
            {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
          </p>

          {/* Owner */}
          <div className={`flex items-center gap-1.5 ${isCompact ? "mt-1" : "mt-1.5"}`}>
            {plan.owner ? (
              <>
                {plan.owner.avatarUrl ? (
                  <img
                    src={plan.owner.avatarUrl}
                    alt=""
                    className={`rounded-full object-cover flex-shrink-0 ${
                      isCompact ? "w-4 h-4" : "w-5 h-5"
                    }`}
                  />
                ) : (
                  <div
                    className={`rounded-full bg-plum/10 flex items-center justify-center text-plum font-semibold flex-shrink-0 ${
                      isCompact ? "w-4 h-4 text-[8px]" : "w-5 h-5 text-[9px]"
                    }`}
                  >
                    {getInitials(plan.owner.fullName)}
                  </div>
                )}
                <span className={`text-gray-500 truncate ${isCompact ? "text-[11px]" : "text-xs"}`}>
                  {plan.owner.fullName}
                </span>
              </>
            ) : (
              <span className={`text-gray-400 italic ${isCompact ? "text-[11px]" : "text-xs"}`}>
                Unassigned
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // --- Back Face ---
  const backFace = (
    <div className="absolute inset-0" style={backFaceStyle}>
      <div
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        className={`
          h-full rounded-xl bg-white border border-gray-100 hover:border-gray-200 hover:shadow-sm
          transition-all cursor-pointer overflow-hidden flex
          ${isCompact ? "p-3" : "p-4"}
        `}
      >
        {/* Left color bar */}
        <div
          className="w-[3px] rounded-full flex-shrink-0 self-stretch"
          style={{ backgroundColor: plan.color }}
        />

        {/* Content */}
        <div className={`flex-1 min-w-0 ${isCompact ? "ml-2.5" : "ml-3"}`}>
          {/* Top row: status + FY + flip */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${statusStyle.bg} ${statusStyle.text}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${statusStyle.dot}`} />
                {plan.status}
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-plum text-white">
                FY{String(plan.fiscalYear).slice(-2)}
              </span>
            </div>
            {flipIcon}
          </div>

          {/* Description */}
          {plan.description && (
            <p className={`text-gray-500 line-clamp-2 mt-1.5 ${isCompact ? "text-[11px]" : "text-xs"}`}>
              {plan.description}
            </p>
          )}

          {/* States */}
          {statesList && (
            <p className={`text-gray-400 truncate mt-1 ${isCompact ? "text-[11px]" : "text-xs"}`}>
              <span className="text-gray-500 font-medium">States:</span> {statesList}
            </p>
          )}

          {/* Date range */}
          {dateRange && (
            <p className={`text-gray-400 mt-1 ${isCompact ? "text-[11px]" : "text-xs"}`}>
              <span className="text-gray-500 font-medium">Dates:</span> {dateRange}
            </p>
          )}

          {/* Enrollment */}
          {plan.totalEnrollment > 0 && (
            <p className={`text-gray-400 mt-1 ${isCompact ? "text-[11px]" : "text-xs"}`}>
              <span className="text-gray-500 font-medium">Enrollment:</span>{" "}
              {formatNumber(plan.totalEnrollment)} students
            </p>
          )}

          {/* Task progress */}
          {plan.taskCount > 0 && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-plum/60"
                  style={{ width: `${taskProgress}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 shrink-0 tabular-nums">
                {plan.completedTaskCount}/{plan.taskCount}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={`relative ${isCompact ? "h-[88px]" : "h-[100px]"}`}
      style={{ perspective: "800px" }}
    >
      <div
        className="relative w-full h-full transition-transform duration-500"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {frontFace}
        {backFace}
      </div>
    </div>
  );
}
