"use client";

// ActivitiesTable - Table view for activities with inline editing.
// Displays all activities in a tabular format with columns for icon, title,
// type, status, dates, scope, and actions.
// When status changes to "completed", an OutcomeModal appears so the
// rep can tag what resulted from the activity (e.g. "Moved Forward", "Got Reply").

import { useState } from "react";
import {
  useUpdateActivity,
  type ActivityListItem,
} from "@/lib/api";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  ALL_ACTIVITY_TYPES,
  VALID_ACTIVITY_STATUSES,
  type ActivityType,
  type ActivityStatus,
} from "@/features/activities/types";
import { OUTCOME_CONFIGS, type OutcomeType } from "@/features/activities/outcome-types";
import InlineEditCell from "@/features/shared/components/InlineEditCell";
import { formatScope } from "@/features/shared/lib/format";
import OutcomeModal from "@/features/activities/components/OutcomeModal";
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";

interface ActivitiesTableProps {
  activities: ActivityListItem[];
  onEdit: (activity: ActivityListItem) => void;
  onDelete: (activityId: string) => void;
  onUnlink?: (activityId: string) => void;
  isDeleting?: boolean;
}

// Build TYPE_OPTIONS from ALL_ACTIVITY_TYPES
const TYPE_OPTIONS = ALL_ACTIVITY_TYPES.map((type) => ({
  value: type,
  label: ACTIVITY_TYPE_LABELS[type as ActivityType] || type,
}));

// Build STATUS_OPTIONS from VALID_ACTIVITY_STATUSES
const STATUS_OPTIONS = VALID_ACTIVITY_STATUSES.map((status) => ({
  value: status,
  label: ACTIVITY_STATUS_CONFIG[status as ActivityStatus]?.label || status,
}));

// formatScope imported from @/features/shared/lib/format

// ActivityStatus = "planned" | "completed" | "cancelled" (no "in_progress").
const ACTIVITY_STATUS_ORDER: Record<string, number> = {
  planned: 0,
  completed: 1,
  cancelled: 2,
};

// Module-level constant so useSortableTable's useMemo dependency stays stable.
const activityComparators: Record<string, SortComparator<ActivityListItem>> = {
  status: (a, b, dir) => {
    const r = (ACTIVITY_STATUS_ORDER[a.status] ?? 9) - (ACTIVITY_STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
  startDate: (a, b, dir) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    const r = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    return dir === "desc" ? -r : r;
  },
};

// Delete confirmation modal
interface DeleteConfirmModalProps {
  activity: ActivityListItem;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  activity,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Activity?</h3>
        <p className="text-[#6E6390] text-sm mb-6">
          Are you sure you want to delete &ldquo;{activity.title}&rdquo;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ActivitiesTable({
  activities,
  onEdit,
  onDelete,
  onUnlink,
  isDeleting = false,
}: ActivitiesTableProps) {
  const [activityToDelete, setActivityToDelete] = useState<ActivityListItem | null>(null);
  // Track which activity just got marked "completed" so we can show the outcome modal
  const [outcomeActivity, setOutcomeActivity] = useState<ActivityListItem | null>(null);

  const updateActivity = useUpdateActivity();

  const { sorted: sortedActivities, sortState, onSort } = useSortableTable({
    data: activities,
    comparators: activityComparators,
  });

  // Handle inline field updates — intercepts status → "completed" to show outcome popover
  const handleFieldUpdate = async (
    activityId: string,
    field: string,
    value: string
  ) => {
    await updateActivity.mutateAsync({
      activityId,
      [field]: value,
    });

    // If the status was just changed to "completed", trigger the outcome popover
    if (field === "status" && value === "completed") {
      const activity = activities.find((a) => a.id === activityId);
      if (activity && !activity.outcomeType) {
        setOutcomeActivity({ ...activity, status: "completed" as ActivityStatus });
      }
    }
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (activityToDelete) {
      onDelete(activityToDelete.id);
      setActivityToDelete(null);
    }
  };

  // Empty state
  if (activities.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-lg border border-[#D4CFE2]">
        <svg
          className="w-12 h-12 mx-auto text-[#C2BBD4] mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="text-base font-medium text-[#6E6390] mb-1">No activities yet</h3>
        <p className="text-sm text-[#8A80A8] max-w-sm mx-auto">
          Create your first activity to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#E2DEEC] bg-[#F7F5FA]">
              <th
                className="w-10 px-3 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider"
                aria-label="Icon"
              >
                {/* Icon column — not sortable */}
              </th>
              <SortHeader
                field="title"
                label="Title"
                sortState={sortState}
                onSort={onSort}
              />
              <SortHeader
                field="type"
                label="Type"
                sortState={sortState}
                onSort={onSort}
                className="whitespace-nowrap"
              />
              <SortHeader
                field="status"
                label="Status"
                sortState={sortState}
                onSort={onSort}
                className="whitespace-nowrap"
              />
              <SortHeader
                field="startDate"
                label="Date"
                sortState={sortState}
                onSort={onSort}
                className="whitespace-nowrap"
              />
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider whitespace-nowrap">
                Scope
              </th>
              <th className="w-12 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {sortedActivities.map((activity, idx) => {
              const typeIcon = ACTIVITY_TYPE_ICONS[activity.type as ActivityType] || "📋";
              const isLast = idx === sortedActivities.length - 1;

              // Format date display
              const hasDateRange =
                activity.endDate &&
                activity.endDate !== activity.startDate;

              return (
                <tr
                  key={activity.id}
                  className={`group transition-colors duration-100 hover:bg-[#EFEDF5] ${!isLast ? "border-b border-[#E2DEEC]" : ""}`}
                >
                  {/* Icon */}
                  <td className="px-3 py-3 text-center text-base">
                    <span>{typeIcon}</span>
                  </td>

                  {/* Title — click to open full editor */}
                  <td className="px-4 py-3 truncate">
                    <button
                      onClick={() => onEdit(activity)}
                      className="text-sm font-medium text-[#403770] truncate text-left w-full hover:underline cursor-pointer"
                    >
                      {activity.title}
                    </button>
                  </td>

                  {/* Type (editable select) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <InlineEditCell
                      type="select"
                      value={activity.type}
                      onSave={async (value) => handleFieldUpdate(activity.id, "type", value)}
                      options={TYPE_OPTIONS}
                      className="text-sm text-[#6E6390]"
                    />
                  </td>

                  {/* Status (editable select) + outcome badge if tagged */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <InlineEditCell
                        type="select"
                        value={activity.status}
                        onSave={async (value) => handleFieldUpdate(activity.id, "status", value)}
                        options={STATUS_OPTIONS}
                        className="text-sm text-[#6E6390]"
                      />
                      {/* Show outcome badge if activity has been tagged */}
                      {activity.outcomeType && OUTCOME_CONFIGS[activity.outcomeType as OutcomeType] && (
                        <span
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
                          style={{
                            backgroundColor: OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].bgColor,
                            color: OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].color,
                          }}
                          title={OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].description}
                        >
                          {OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].icon}{" "}
                          {OUTCOME_CONFIGS[activity.outcomeType as OutcomeType].label}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Date (editable) */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    {activity.startDate ? (
                      <div className="flex items-center gap-1 text-sm text-[#6E6390]">
                        <InlineEditCell
                          type="date"
                          value={activity.startDate}
                          onSave={async (value) => handleFieldUpdate(activity.id, "startDate", value)}
                          className="text-sm"
                        />
                        {hasDateRange && (
                          <>
                            <span className="text-[#A69DC0]">&ndash;</span>
                            <InlineEditCell
                              type="date"
                              value={activity.endDate}
                              onSave={async (value) => handleFieldUpdate(activity.id, "endDate", value)}
                              className="text-sm"
                            />
                          </>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-[#A69DC0]">&mdash;</span>
                    )}
                  </td>

                  {/* Scope (display only) */}
                  <td className="px-4 py-3 text-sm text-[#6E6390] whitespace-nowrap">
                    {formatScope(activity.districtCount, activity.stateAbbrevs)}
                  </td>

                  {/* Actions — appear on hover */}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                      {onUnlink && (
                        <button
                          onClick={() => onUnlink(activity.id)}
                          className="p-1.5 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#F37167]/5 transition-colors"
                          aria-label="Remove from plan"
                          title="Remove from plan"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.181 8.68a4 4 0 00-5.3.5l-2.5 2.5a4 4 0 005.6 5.6l.9-.9M10.82 15.32a4 4 0 005.3-.5l2.5-2.5a4 4 0 00-5.6-5.6l-.9.9" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 8l8 8" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => setActivityToDelete(activity)}
                        className="p-1.5 text-[#A69DC0] hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                        aria-label="Delete activity"
                        title="Delete"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
        <span className="text-xs font-medium text-[#8A80A8] tracking-wide">
          {activities.length} activit{activities.length !== 1 ? "ies" : "y"}
        </span>
      </div>

      {/* Delete Confirmation Modal */}
      {activityToDelete && (
        <DeleteConfirmModal
          activity={activityToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setActivityToDelete(null)}
          isDeleting={isDeleting}
        />
      )}

      {/* Outcome Modal — appears after marking an activity "completed" */}
      {outcomeActivity && (
        <OutcomeModal
          activity={{
            id: outcomeActivity.id,
            type: outcomeActivity.type,
            title: outcomeActivity.title,
          }}
          sourceContext={{
            planIds: undefined,
            districtLeaids: undefined,
            contactIds: undefined,
          }}
          onClose={() => setOutcomeActivity(null)}
        />
      )}
    </div>
  );
}
