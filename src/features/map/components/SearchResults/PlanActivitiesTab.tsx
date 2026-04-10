"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useActivities, useUnlinkActivityPlan } from "@/lib/api";
import type { ActivityListItem, ActivitiesResponse } from "@/features/shared/types/api-types";
import { formatStatusLabel } from "@/features/activities/types";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import ActivityViewPanel from "@/features/activities/components/ActivityViewPanel";
import ActivitySearchModal from "@/features/plans/components/ActivitySearchModal";

interface PlanActivitiesTabProps {
  planId: string;
}

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  call: { bg: "bg-[#e8f1f5]", text: "text-[#5A8FA8]" },
  email: { bg: "bg-[#f0edf5]", text: "text-[#6E6390]" },
  meeting: { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" },
  demo: { bg: "bg-[#FEF3C7]", text: "text-[#92700C]" },
  visit: { bg: "bg-[#FEF2F1]", text: "text-[#C4534A]" },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function PlanActivitiesTab({ planId }: PlanActivitiesTabProps) {
  const { data, isLoading } = useActivities({ planId });
  const response = data as ActivitiesResponse | undefined;
  const activities = response?.activities ?? [];
  const [isCreating, setIsCreating] = useState(false);
  const [viewingActivityId, setViewingActivityId] = useState<string | null>(null);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showAddDropdown, setShowAddDropdown] = useState(false);
  const addDropdownRef = useRef<HTMLDivElement>(null);
  const unlinkActivityPlan = useUnlinkActivityPlan();

  const linkedActivityIds = useMemo(
    () => new Set(activities.map((a) => a.id)),
    [activities]
  );

  // Close dropdown on outside click
  useEffect(() => {
    if (!showAddDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (addDropdownRef.current && !addDropdownRef.current.contains(e.target as Node)) {
        setShowAddDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showAddDropdown]);

  const handleUnlink = async (activityId: string) => {
    await unlinkActivityPlan.mutateAsync({ activityId, planId });
  };

  if (isLoading) {
    return (
      <div className="p-5 space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-[#f0edf5]">
            <div className="h-3 bg-[#f0edf5] rounded w-2/3 mb-2" />
            <div className="h-2.5 bg-[#f0edf5] rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  // ─── Drill-in: Activity detail/edit view ──────────────────────
  if (viewingActivityId) {
    return (
      <div className="flex flex-col h-full">
        {/* Back bar */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-2 border-b border-[#E2DEEC] bg-[#FAFAFE]">
          <button
            onClick={() => setViewingActivityId(null)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6390] hover:text-[#403770] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Activities
          </button>
        </div>
        {/* ActivityViewPanel fills remaining space — manages its own scroll + sticky save footer */}
        <ActivityViewPanel
          activityId={viewingActivityId}
          onViewRelated={(id) => setViewingActivityId(id)}
        />
      </div>
    );
  }

  // ─── Drill-in: Create new activity ───────────────────────────
  if (isCreating) {
    return (
      <div className="flex flex-col h-full">
        {/* Back bar */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-2 border-b border-[#E2DEEC] bg-[#FAFAFE]">
          <button
            onClick={() => setIsCreating(false)}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#6E6390] hover:text-[#403770] transition-colors"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M7.5 2.5L4 6L7.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back to Activities
          </button>
        </div>
        <ActivityFormModal
          isOpen
          onClose={() => setIsCreating(false)}
          defaultPlanId={planId}
          embedded
        />
      </div>
    );
  }

  // ─── List view ────────────────────────────────────────────────

  if (activities.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-[#6E6390]">No activities yet</p>
          <p className="text-xs text-[#A69DC0] mt-1">Activities linked to this plan will appear here.</p>
          <div ref={addDropdownRef} className="relative mt-3">
            <button
              onClick={() => setShowAddDropdown((prev) => !prev)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors inline-flex items-center gap-1"
            >
              + Add Activity
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showAddDropdown && (
              <div className="absolute left-1/2 -translate-x-1/2 mt-1 w-44 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden z-20">
                <button
                  onClick={() => { setShowAddDropdown(false); setShowSearchModal(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left"
                >
                  <svg className="w-3.5 h-3.5 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" strokeWidth="2" />
                    <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Link Existing
                </button>
                <button
                  onClick={() => { setShowAddDropdown(false); setIsCreating(true); }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left border-t border-[#F7F5FA]"
                >
                  <svg className="w-3.5 h-3.5 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New
                </button>
              </div>
            )}
          </div>
        </div>
        <ActivitySearchModal
          isOpen={showSearchModal}
          onClose={() => setShowSearchModal(false)}
          planId={planId}
          linkedActivityIds={linkedActivityIds}
        />
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-2">
        {activities.map((activity: ActivityListItem) => {
          const type = activity.type ?? "call";
          const subject = activity.title ?? "Untitled";
          const startDate = activity.startDate;
          const status = activity.status;
          const stateAbbrevs = activity.stateAbbrevs ?? [];
          const typeColor = TYPE_COLORS[type.toLowerCase()] ?? TYPE_COLORS.call;

          return (
            <div
              key={activity.id}
              className="p-3 rounded-lg border border-[#E2DEEC] hover:border-[#D4CFE2] hover:bg-[#FAFAFE] transition-colors cursor-pointer group"
            >
              <div
                onClick={() => setViewingActivityId(activity.id)}
                className="flex items-start justify-between gap-2 mb-1"
              >
                <span className="text-xs font-semibold text-[#544A78] truncate flex-1 group-hover:text-[#403770]">
                  {subject}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${typeColor.bg} ${typeColor.text}`}
                  >
                    {type}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleUnlink(activity.id); }}
                    className="p-0.5 text-[#C2BBD4] hover:text-[#F37167] rounded opacity-0 group-hover:opacity-100 transition-all"
                    title="Remove from plan"
                    aria-label="Remove from plan"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <div
                onClick={() => setViewingActivityId(activity.id)}
                className="flex items-center gap-3 text-[11px] text-[#8A80A8]"
              >
                {startDate && <span>{formatDate(startDate)}</span>}
                {status && <span>{formatStatusLabel(status)}</span>}
                {stateAbbrevs.length > 0 && (
                  <span className="truncate">{stateAbbrevs.join(", ")}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        <div ref={addDropdownRef} className="relative">
          <button
            onClick={() => setShowAddDropdown((prev) => !prev)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Add
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showAddDropdown && (
            <div className="absolute bottom-full left-0 mb-1 w-44 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden z-20">
              <button
                onClick={() => { setShowAddDropdown(false); setShowSearchModal(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left"
              >
                <svg className="w-3.5 h-3.5 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" strokeWidth="2" />
                  <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Link Existing
              </button>
              <button
                onClick={() => { setShowAddDropdown(false); setIsCreating(true); }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left border-t border-[#F7F5FA]"
              >
                <svg className="w-3.5 h-3.5 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New
              </button>
            </div>
          )}
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          {activities.length} activit{activities.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Activity Search Modal */}
      <ActivitySearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        planId={planId}
        linkedActivityIds={linkedActivityIds}
      />
    </div>
  );
}
