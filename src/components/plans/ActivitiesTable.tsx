"use client";

// ActivitiesTable - Table view for activities with inline editing.
// Displays all activities in a tabular format with columns for icon, title,
// type, status, dates, scope, and actions.

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
} from "@/lib/activityTypes";
import InlineEditCell from "@/components/common/InlineEditCell";

interface ActivitiesTableProps {
  activities: ActivityListItem[];
  onEdit: (activity: ActivityListItem) => void;
  onDelete: (activityId: string) => void;
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

// Format date for display as MM/DD/YYYY
// Extracts the YYYY-MM-DD portion first so it works with both
// bare date strings ("2026-02-05") and full ISO strings ("2026-02-05T00:00:00.000Z").
function formatDate(dateString: string): string {
  const datePart = dateString.split("T")[0];
  const date = new Date(datePart + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

// Format scope text: "X district(s) (STATE, STATE)"
function formatScope(districtCount: number, stateAbbrevs: string[]): string {
  if (districtCount === 0 && stateAbbrevs.length === 0) {
    return "All districts";
  }
  if (districtCount === 0) {
    return stateAbbrevs.join(", ");
  }
  const districtText = `${districtCount} district${districtCount !== 1 ? "s" : ""}`;
  if (stateAbbrevs.length > 0) {
    return `${districtText} (${stateAbbrevs.join(", ")})`;
  }
  return districtText;
}

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
        <p className="text-gray-600 text-sm mb-6">
          Are you sure you want to delete &ldquo;{activity.title}&rdquo;? This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
  isDeleting = false,
}: ActivitiesTableProps) {
  const [activityToDelete, setActivityToDelete] = useState<ActivityListItem | null>(null);

  const updateActivity = useUpdateActivity();

  // Handle inline field updates
  const handleFieldUpdate = async (
    activityId: string,
    field: string,
    value: string
  ) => {
    await updateActivity.mutateAsync({
      activityId,
      [field]: value,
    });
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
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
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
        <h3 className="text-lg font-medium text-gray-600 mb-2">No activities yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Create your first activity to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="w-full table-fixed divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="w-[28px] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                aria-label="Icon"
              >
                {/* Icon column */}
              </th>
              <th className="w-[30%] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Title
              </th>
              <th className="w-[15%] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Type
              </th>
              <th className="w-[12%] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="w-[18%] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="w-[15%] px-2 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Scope
              </th>
              <th className="w-[60px] px-2 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {activities.map((activity) => {
              const typeIcon = ACTIVITY_TYPE_ICONS[activity.type as ActivityType] || "📋";
              const typeLabel = ACTIVITY_TYPE_LABELS[activity.type as ActivityType] || activity.type;
              const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status as ActivityStatus];

              // Format date display
              const hasDateRange =
                activity.endDate &&
                activity.endDate !== activity.startDate;
              const dateDisplay = hasDateRange
                ? `${formatDate(activity.startDate)} - ${formatDate(activity.endDate!)}`
                : formatDate(activity.startDate);

              return (
                <tr
                  key={activity.id}
                  className="hover:bg-gray-50 transition-colors"
                >
                  {/* Icon */}
                  <td className="px-2 py-1.5 text-center text-base">
                    <span>{typeIcon}</span>
                  </td>

                  {/* Title (editable) */}
                  <td className="px-2 py-1 truncate">
                    <InlineEditCell
                      type="text"
                      value={activity.title}
                      onSave={async (value) => handleFieldUpdate(activity.id, "title", value)}
                      className="text-sm font-medium text-[#403770] truncate"
                    />
                  </td>

                  {/* Type (editable select) */}
                  <td className="px-2 py-1">
                    <InlineEditCell
                      type="select"
                      value={activity.type}
                      onSave={async (value) => handleFieldUpdate(activity.id, "type", value)}
                      options={TYPE_OPTIONS}
                      className="text-xs text-gray-600"
                    />
                  </td>

                  {/* Status (editable select) */}
                  <td className="px-2 py-1">
                    <InlineEditCell
                      type="select"
                      value={activity.status}
                      onSave={async (value) => handleFieldUpdate(activity.id, "status", value)}
                      options={STATUS_OPTIONS}
                      className="text-xs font-medium px-1.5 py-0.5 rounded-full inline-block"
                    />
                  </td>

                  {/* Date (editable) */}
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-0.5 text-xs text-gray-600">
                      <InlineEditCell
                        type="date"
                        value={activity.startDate}
                        onSave={async (value) => handleFieldUpdate(activity.id, "startDate", value)}
                        className="text-xs"
                      />
                      {hasDateRange && (
                        <>
                          <span className="text-gray-400">-</span>
                          <InlineEditCell
                            type="date"
                            value={activity.endDate}
                            onSave={async (value) => handleFieldUpdate(activity.id, "endDate", value)}
                            className="text-xs"
                          />
                        </>
                      )}
                    </div>
                  </td>

                  {/* Scope (display only) */}
                  <td className="px-2 py-1.5 text-xs text-gray-600 truncate max-w-[100px]">
                    {formatScope(activity.districtCount, activity.stateAbbrevs)}
                  </td>

                  {/* Actions */}
                  <td className="px-2 py-1.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onEdit(activity)}
                        className="text-xs text-[#403770] hover:text-[#F37167] transition-colors"
                        aria-label="Edit activity"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setActivityToDelete(activity)}
                        className="text-xs text-red-500 hover:text-red-700 transition-colors"
                        aria-label="Delete activity"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
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
    </div>
  );
}
