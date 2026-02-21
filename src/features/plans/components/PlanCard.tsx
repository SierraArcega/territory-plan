"use client";

import Link from "next/link";
import type { TerritoryPlan, PlanEngagement } from "@/lib/api";

interface PlanCardProps {
  plan: TerritoryPlan;
  /** Optional engagement data for health indicators */
  engagement?: PlanEngagement;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const datePart = dateString.split("T")[0];
  return new Date(datePart + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "planning":
      return {
        label: "Planning",
        className: "bg-gray-200 text-gray-700",
      };
    case "working":
      return {
        label: "Working",
        className: "bg-[#8AA891] text-white",
      };
    case "stale":
      return {
        label: "Stale",
        className: "bg-amber-200 text-amber-800",
      };
    case "archived":
      return {
        label: "Archived",
        className: "bg-gray-400 text-white",
      };
    default:
      return {
        label: status,
        className: "bg-gray-200 text-gray-700",
      };
  }
}

// Compute activity recency label and color from the engagement data
function getRecencyBadge(lastActivityDate: string | null) {
  if (!lastActivityDate) {
    return { label: "No activity", color: "#9CA3AF", bgColor: "#F3F4F6" };
  }
  const daysSince = Math.floor(
    (Date.now() - new Date(lastActivityDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (daysSince <= 7) {
    return { label: `Active ${daysSince}d ago`, color: "#8AA891", bgColor: "#EFF5F0" };
  }
  if (daysSince <= 21) {
    return { label: `${Math.floor(daysSince / 7)}w ago`, color: "#D97706", bgColor: "#FEF3C7" };
  }
  return { label: `Stale — ${Math.floor(daysSince / 7)}w`, color: "#F37167", bgColor: "#FEF2F1" };
}

export default function PlanCard({ plan, engagement }: PlanCardProps) {
  const statusBadge = getStatusBadge(plan.status);
  const dateRange =
    plan.startDate || plan.endDate
      ? `${formatDate(plan.startDate)}${plan.startDate && plan.endDate ? " - " : ""}${formatDate(plan.endDate)}`
      : null;

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg hover:border-[#403770]/30 transition-all group"
    >
      {/* Header with color dot and status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="w-4 h-4 rounded-full flex-shrink-0"
            style={{ backgroundColor: plan.color }}
          />
          <h3 className="text-lg font-semibold text-[#403770] truncate group-hover:text-[#F37167] transition-colors">
            {plan.name}
          </h3>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white">
            FY{String(plan.fiscalYear).slice(-2)}
          </span>
          <span
            className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      {/* Description */}
      {plan.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {plan.description}
        </p>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500">
        <div className="flex items-center gap-1.5">
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          <span>
            {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
          </span>
        </div>

        {dateRange && (
          <div className="flex items-center gap-1.5">
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{dateRange}</span>
          </div>
        )}
      </div>

      {/* Engagement bar — districts with at least one activity */}
      {engagement && engagement.totalDistricts > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-gray-400">
              {engagement.districtsWithActivity}/{engagement.totalDistricts} districts engaged
            </span>
            {/* Recency badge */}
            {(() => {
              const badge = getRecencyBadge(engagement.lastActivityDate);
              return (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: badge.bgColor, color: badge.color }}
                >
                  {badge.label}
                </span>
              );
            })()}
          </div>
          <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.round((engagement.districtsWithActivity / engagement.totalDistricts) * 100)}%`,
                backgroundColor: plan.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Owner */}
      {plan.owner?.fullName && (
        <div className={`${engagement && engagement.totalDistricts > 0 ? "mt-2" : "mt-3 pt-3 border-t border-gray-100"} flex items-center gap-2 text-sm`}>
          <span className="text-gray-400">Owner:</span>
          <span className="text-[#403770] font-medium">{plan.owner.fullName}</span>
        </div>
      )}
    </Link>
  );
}
