"use client";

import Link from "next/link";
import type { TerritoryPlan } from "@/lib/api";

interface PlanCardProps {
  plan: TerritoryPlan;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return {
        label: "Draft",
        className: "bg-gray-200 text-gray-700",
      };
    case "active":
      return {
        label: "Active",
        className: "bg-[#8AA891] text-white",
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

export default function PlanCard({ plan }: PlanCardProps) {
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

      {/* Owner */}
      {(plan.ownerUser || plan.owner) && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm">
          <span className="text-gray-400">Owner:</span>
          <span className="text-[#403770] font-medium">{plan.ownerUser?.fullName || plan.owner}</span>
        </div>
      )}
    </Link>
  );
}
