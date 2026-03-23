"use client";

import { useState } from "react";
import { useActivities } from "@/lib/api";
import type { ActivityListItem, ActivitiesResponse } from "@/features/shared/types/api-types";
import { formatStatusLabel } from "@/features/activities/types";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import ActivityViewPanel from "@/features/activities/components/ActivityViewPanel";

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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewingActivityId, setViewingActivityId] = useState<string | null>(null);

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

  if (activities.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium text-[#6E6390]">No activities yet</p>
          <p className="text-xs text-[#A69DC0] mt-1">Activities linked to this plan will appear here.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
          >
            + Add Activity
          </button>
        </div>
        <ActivityFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          defaultPlanId={planId}
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
              onClick={() => setViewingActivityId(activity.id)}
              className="p-3 rounded-lg border border-[#E2DEEC] hover:border-[#D4CFE2] hover:bg-[#FAFAFE] transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-[#544A78] truncate flex-1 group-hover:text-[#403770]">
                  {subject}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${typeColor.bg} ${typeColor.text}`}
                >
                  {type}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[11px] text-[#8A80A8]">
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
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#544A78] transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Add Activity
        </button>
        <span className="text-[11px] text-[#A69DC0]">
          {activities.length} activit{activities.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Create modal */}
      <ActivityFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        defaultPlanId={planId}
      />

      {/* View/Edit overlay */}
      {viewingActivityId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setViewingActivityId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-[65vw] max-w-[960px] h-[65vh] max-h-[700px] flex flex-col overflow-hidden">
            <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-[#E2DEEC]">
              <span className="text-sm font-bold text-[#403770]">Activity Details</span>
              <button
                onClick={() => setViewingActivityId(null)}
                className="p-1.5 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#f0edf5] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ActivityViewPanel
                activityId={viewingActivityId}
                onViewRelated={(id) => setViewingActivityId(id)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
