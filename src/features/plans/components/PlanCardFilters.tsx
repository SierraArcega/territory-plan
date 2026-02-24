"use client";

import { useMemo } from "react";
import type { TerritoryPlan, PlanOwner } from "@/features/shared/types/api-types";

export type PlanSortKey = "updated" | "name" | "districts" | "totalTarget";

const SORT_OPTIONS: Array<{ key: PlanSortKey; label: string }> = [
  { key: "updated", label: "Recently updated" },
  { key: "name", label: "Name A-Z" },
  { key: "districts", label: "Most districts" },
  { key: "totalTarget", label: "Largest target" },
];

interface PlanCardFiltersProps {
  plans: TerritoryPlan[];
  selectedOwnerId: string | null;
  onOwnerChange: (ownerId: string | null) => void;
  sortBy: PlanSortKey;
  onSortChange: (sort: PlanSortKey) => void;
  variant: "compact" | "full";
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.substring(0, 2).toUpperCase();
}

export default function PlanCardFilters({
  plans,
  selectedOwnerId,
  onOwnerChange,
  sortBy,
  onSortChange,
  variant,
}: PlanCardFiltersProps) {
  const isCompact = variant === "compact";
  const avatarSize = isCompact ? 24 : 28;

  // Derive unique owners from plans
  const uniqueOwners = useMemo(() => {
    const ownerMap = new Map<string, PlanOwner>();
    for (const plan of plans) {
      if (plan.owner && !ownerMap.has(plan.owner.id)) {
        ownerMap.set(plan.owner.id, plan.owner);
      }
    }
    return Array.from(ownerMap.values());
  }, [plans]);

  return (
    <div className={`flex items-center gap-2 ${isCompact ? "mb-2" : "mb-3"}`}>
      {/* Owner avatar chips */}
      <div
        className={`flex items-center gap-1.5 flex-1 min-w-0 ${
          isCompact ? "overflow-x-auto" : "flex-wrap"
        }`}
      >
        {/* "All" chip */}
        <button
          onClick={() => onOwnerChange(null)}
          className={`
            flex-shrink-0 rounded-full transition-all text-[10px] font-semibold
            flex items-center justify-center
            focus-visible:ring-2 focus-visible:ring-plum focus:outline-none
            ${selectedOwnerId === null
              ? "ring-2 ring-plum text-plum bg-plum/10"
              : "text-gray-400 bg-gray-100 hover:bg-gray-200"
            }
          `}
          style={{ width: avatarSize, height: avatarSize }}
          aria-label="Show all plans"
        >
          All
        </button>

        {/* Owner chips */}
        {uniqueOwners.map((owner) => (
          <button
            key={owner.id}
            onClick={() => onOwnerChange(owner.id)}
            title={owner.fullName ?? "Unknown"}
            className={`
              flex-shrink-0 rounded-full transition-all overflow-hidden
              focus-visible:ring-2 focus-visible:ring-plum focus:outline-none
              ${selectedOwnerId === owner.id
                ? "ring-2 ring-plum"
                : "ring-1 ring-gray-200 hover:ring-gray-300"
              }
            `}
            style={{ width: avatarSize, height: avatarSize }}
            aria-label={`Filter by ${owner.fullName ?? "Unknown"}`}
          >
            {owner.avatarUrl ? (
              <img
                src={owner.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center bg-plum/10 text-plum font-semibold"
                style={{ fontSize: isCompact ? 9 : 10 }}
              >
                {getInitials(owner.fullName)}
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Sort dropdown */}
      {isCompact ? (
        <div className="flex-shrink-0 relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as PlanSortKey)}
            className="appearance-none bg-gray-100 text-gray-500 text-[10px] rounded-lg pl-2 pr-5 py-1 cursor-pointer hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-plum/40"
            aria-label="Sort plans"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
            width="8"
            height="8"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        <div className="flex-shrink-0 relative">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as PlanSortKey)}
            className="appearance-none bg-gray-100 text-gray-500 text-xs rounded-lg pl-3 pr-7 py-1.5 cursor-pointer hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-plum/40"
            aria-label="Sort plans"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
          >
            <path d="M2 4L5 7L8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
}

/**
 * Sort and filter plans based on PlanCardFilters state.
 * Call this in the parent component with useMemo.
 */
export function filterAndSortPlans(
  plans: TerritoryPlan[],
  selectedOwnerId: string | null,
  sortBy: PlanSortKey,
): TerritoryPlan[] {
  let filtered = plans;

  // Owner filter
  if (selectedOwnerId) {
    filtered = filtered.filter((p) => p.owner?.id === selectedOwnerId);
  }

  // Sort
  const sorted = [...filtered];
  switch (sortBy) {
    case "updated":
      sorted.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      break;
    case "name":
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "districts":
      sorted.sort((a, b) => b.districtCount - a.districtCount);
      break;
    case "totalTarget": {
      const total = (p: TerritoryPlan) =>
        p.renewalRollup + p.expansionRollup + p.winbackRollup + p.newBusinessRollup;
      sorted.sort((a, b) => total(b) - total(a));
      break;
    }
  }

  return sorted;
}
