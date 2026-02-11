"use client";

import { useState } from "react";
import { type ActivityListItem } from "@/lib/api";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  type ActivityType,
} from "@/lib/activityTypes";
import { OUTCOME_CONFIGS, type OutcomeType } from "@/lib/outcomeTypes";

interface ActivityCardProps {
  activity: ActivityListItem;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

export default function ActivityCard({
  activity,
  onEdit,
  onDelete,
  isDeleting = false,
}: ActivityCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.type as ActivityType] || activity.type;
  const typeIcon = ACTIVITY_TYPE_ICONS[activity.type as ActivityType] || "📋";

  // Format start date nicely
  const formattedDate = activity.startDate
    ? new Date(activity.startDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Unscheduled";

  // Format date range if end date is different from start date
  const hasDateRange = activity.endDate && activity.endDate !== activity.startDate;
  const formattedEndDate = activity.endDate
    ? new Date(activity.endDate).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;

  // Determine if activity is in the past or future
  const startDate = activity.startDate ? new Date(activity.startDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = startDate ? startDate < today : false;
  const isToday = startDate ? startDate.toDateString() === today.toDateString() : false;

  // Scope display text - show district count and states
  const scopeText =
    activity.districtCount > 0
      ? `${activity.districtCount} district${activity.districtCount !== 1 ? "s" : ""}${
          activity.stateAbbrevs.length > 0 ? ` (${activity.stateAbbrevs.join(", ")})` : ""
        }`
      : activity.stateAbbrevs.length > 0
        ? activity.stateAbbrevs.join(", ")
        : "All districts";

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      {/* Header row: icon, title, status */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-3 min-w-0">
          <span className="text-xl flex-shrink-0">{typeIcon}</span>
          <div className="min-w-0">
            <h4 className="font-medium text-[#403770] truncate">{activity.title}</h4>
            <p className="text-xs text-gray-500">{typeLabel}</p>
          </div>
        </div>
        <span
          className="px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0"
          style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
        >
          {statusConfig.label}
        </span>
      </div>

      {/* Date and scope row */}
      <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
        <span className={`${isToday ? "text-[#F37167] font-medium" : isPast ? "text-gray-400" : ""}`}>
          {isToday ? "Today" : hasDateRange ? `${formattedDate} - ${formattedEndDate}` : formattedDate}
        </span>
        <span className="text-gray-300">•</span>
        <span className="truncate">{scopeText}</span>
      </div>

      {/* Outcome badge — shows what happened when the activity was completed */}
      {activity.outcomeType && OUTCOME_CONFIGS[activity.outcomeType as OutcomeType] && (
        <div className="mb-3">
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].bgColor,
              color: OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].color,
            }}
          >
            {OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].icon}{" "}
            {OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].label}
          </span>
        </div>
      )}

      {/* Plan count indicator */}
      {activity.planCount > 1 && (
        <div className="flex items-center gap-1.5 mb-3">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span className="text-xs text-gray-500">
            In {activity.planCount} plans
          </span>
        </div>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
        <button
          onClick={onEdit}
          className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-[#403770] hover:bg-gray-100 rounded transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
        </button>
        {showDeleteConfirm ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="px-2 py-1 text-xs text-white bg-red-500 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
