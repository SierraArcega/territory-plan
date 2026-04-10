"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  useActivities,
  useLinkActivityPlans,
  type ActivityListItem,
} from "@/lib/api";
import { useUsers } from "@/features/shared/lib/queries";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  CATEGORY_LABELS,
  ACTIVITY_CATEGORIES,
  type ActivityType,
  type ActivityStatus,
  type ActivityCategory,
} from "@/features/activities/types";
import { formatScope } from "@/features/shared/lib/format";

interface ActivitySearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  planId: string;
  planName?: string;
  linkedActivityIds: Set<string>;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function ActivitySearchModal({
  isOpen,
  onClose,
  planId,
  planName,
  linkedActivityIds,
}: ActivitySearchModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [ownerFilter, setOwnerFilter] = useState<string>("");
  const [isLinking, setIsLinking] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch activities matching filters
  const { data: activitiesResponse, isLoading } = useActivities({
    search: debouncedSearch || undefined,
    category: (categoryFilter as ActivityCategory) || undefined,
    status: (statusFilter as ActivityStatus) || undefined,
    ownerId: ownerFilter || undefined,
    limit: 50,
  });
  const activities = activitiesResponse?.activities ?? [];

  // Fetch team members for owner filter
  const { data: users } = useUsers();

  const linkActivityPlans = useLinkActivityPlans();

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery("");
      setSelectedIds(new Set());
      setCategoryFilter("");
      setStatusFilter("");
      setOwnerFilter("");
      setIsLinking(false);
    }
  }, [isOpen]);

  // Toggle selection for an activity
  const toggleSelection = useCallback(
    (activityId: string) => {
      if (linkedActivityIds.has(activityId)) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(activityId)) {
          next.delete(activityId);
        } else {
          next.add(activityId);
        }
        return next;
      });
    },
    [linkedActivityIds]
  );

  // Handle linking selected activities
  const handleLinkSelected = async () => {
    if (selectedIds.size === 0) return;
    setIsLinking(true);
    setErrorMessage(null);

    try {
      // Link each selected activity to this plan one at a time
      // so partial successes still count
      let linked = 0;
      for (const activityId of selectedIds) {
        try {
          await linkActivityPlans.mutateAsync({ activityId, planIds: [planId] });
          linked++;
        } catch (err) {
          console.error(`Failed to link activity ${activityId}:`, err);
        }
      }
      if (linked > 0) {
        onClose();
      } else {
        setErrorMessage("Failed to link activities. You may not have permission to modify these activities.");
      }
    } catch (err) {
      console.error("Failed to link activities:", err);
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsLinking(false);
    }
  };

  // Count of newly selected (not already linked)
  const newSelectionCount = selectedIds.size;

  // Build category filter options grouped
  const categoryOptions = useMemo(
    () =>
      Object.entries(CATEGORY_LABELS).map(([value, label]) => ({
        value,
        label,
      })),
    []
  );

  // Build status filter options
  const statusOptions = useMemo(
    () =>
      Object.entries(ACTIVITY_STATUS_CONFIG).map(([value, config]) => ({
        value,
        label: config.label,
      })),
    []
  );

  // Build owner filter options
  const ownerOptions = useMemo(() => {
    if (!users) return [];
    return users.map((u) => ({
      value: u.id,
      label: u.fullName || u.email,
    }));
  }, [users]);

  // Check if any filters are active
  const hasActiveFilters = categoryFilter || statusFilter || ownerFilter;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl mx-4 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-[#403770]">
              Link Activities
            </h2>
            {planName && (
              <p className="text-sm text-[#8A80A8] mt-0.5">
                to {planName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#A69DC0] hover:text-[#403770] hover:bg-[#F7F5FA] rounded-lg transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="px-6 pb-3">
          <div className="flex items-center gap-2 px-3 py-2 border-2 border-[#D4CFE2] rounded-lg bg-white focus-within:border-[#403770] focus-within:shadow-[0_0_0_3px_rgba(64,55,112,0.08)] transition-all">
            <svg className="w-4 h-4 text-[#A69DC0] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by activity name..."
              className="flex-1 text-sm text-[#403770] placeholder:text-[#A69DC0] bg-transparent outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-[#A69DC0] hover:text-[#403770]"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 px-6 pb-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs font-medium text-[#6E6390] bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#403770] cursor-pointer"
          >
            <option value="">All Types</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-medium text-[#6E6390] bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#403770] cursor-pointer"
          >
            <option value="">All Statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="text-xs font-medium text-[#6E6390] bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg px-2.5 py-1.5 outline-none focus:border-[#403770] cursor-pointer"
          >
            <option value="">My Activities</option>
            <option value="all">All Owners</option>
            {ownerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              onClick={() => {
                setCategoryFilter("");
                setStatusFilter("");
                setOwnerFilter("");
              }}
              className="text-[10px] font-medium text-[#F37167] hover:text-[#d4574d] ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto border-t border-[#E2DEEC] min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="inline-block w-5 h-5 border-2 border-[#D4CFE2] border-t-[#403770] rounded-full animate-spin" />
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-12 px-6">
              <svg className="w-10 h-10 mx-auto text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-medium text-[#6E6390]">
                {debouncedSearch
                  ? `No activities matching "${debouncedSearch}"`
                  : "No activities found"}
              </p>
              <p className="text-xs text-[#A69DC0] mt-1">
                {debouncedSearch
                  ? "Try a different search term or adjust filters"
                  : "Create some activities first, then link them here"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#F7F5FA]">
              {activities.map((activity) => {
                const isLinked = linkedActivityIds.has(activity.id);
                const isSelected = selectedIds.has(activity.id);
                const typeIcon = ACTIVITY_TYPE_ICONS[activity.type as ActivityType] || "📋";
                const typeLabel = ACTIVITY_TYPE_LABELS[activity.type as ActivityType] || activity.type;
                const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];

                return (
                  <li
                    key={activity.id}
                    className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                      isLinked
                        ? "opacity-50 cursor-default"
                        : isSelected
                          ? "bg-[#F7F5FA] cursor-pointer"
                          : "hover:bg-[#F7F5FA] cursor-pointer"
                    }`}
                    onClick={() => toggleSelection(activity.id)}
                  >
                    {/* Checkbox */}
                    <div className="shrink-0">
                      <input
                        type="checkbox"
                        checked={isLinked || isSelected}
                        disabled={isLinked}
                        onChange={() => toggleSelection(activity.id)}
                        className="w-4 h-4 rounded border-[#D4CFE2] text-[#403770] focus:ring-[#403770] cursor-pointer disabled:cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Type icon */}
                    <span className="text-base shrink-0">{typeIcon}</span>

                    {/* Title + type */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#403770] truncate">
                        {activity.title}
                      </div>
                      <div className="text-[11px] text-[#A69DC0] mt-0.5">
                        {typeLabel}
                        {activity.districtCount > 0 && (
                          <> &middot; {formatScope(activity.districtCount, activity.stateAbbrevs)}</>
                        )}
                      </div>
                    </div>

                    {/* Status badge */}
                    {statusConfig && (
                      <span
                        className="px-2 py-0.5 text-[10px] font-medium rounded-full shrink-0"
                        style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                      >
                        {statusConfig.label}
                      </span>
                    )}

                    {/* Date */}
                    <span className="text-xs text-[#8A80A8] shrink-0 w-20 text-right">
                      {activity.startDate
                        ? new Date(activity.startDate.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </span>

                    {/* Already linked badge */}
                    {isLinked && (
                      <span className="text-[10px] font-medium text-[#F37167] bg-[#F37167]/8 px-2 py-0.5 rounded-full shrink-0">
                        In this plan
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2DEEC] bg-[#F7F5FA] rounded-b-xl space-y-2">
          {errorMessage && (
            <p className="text-xs text-[#F37167] font-medium">{errorMessage}</p>
          )}
          <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleLinkSelected}
            disabled={newSelectionCount === 0 || isLinking}
            className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#352d5c] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isLinking
              ? "Linking..."
              : newSelectionCount === 0
                ? "Select activities"
                : `Add ${newSelectionCount} activit${newSelectionCount !== 1 ? "ies" : "y"}`}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}
