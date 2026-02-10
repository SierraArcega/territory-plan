"use client";

import { useState } from "react";
import {
  useActivities,
  useUpdateActivity,
  useDeleteActivity,
  type ActivityListItem,
} from "@/lib/api";
import {
  type ActivityCategory,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
} from "@/lib/activityTypes";
import ActivityFormModal from "@/components/activities/ActivityFormModal";
import EditActivityFormModal, { type ActivityFormData } from "@/components/plans/ActivityFormModal";
import ViewToggle from "@/components/common/ViewToggle";
import ActivitiesTable from "@/components/plans/ActivitiesTable";

// Tab options for category filtering
type CategoryTab = "all" | ActivityCategory;

const CATEGORY_TABS: { key: CategoryTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "events", label: "Events" },
  { key: "outreach", label: "Outreach" },
  { key: "meetings", label: "Meetings" },
];

// Helper to format dates nicely
function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate) return "Unscheduled";
  const start = new Date(startDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (!endDate) return start;
  const end = new Date(endDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${start} - ${end}`;
}

export default function ActivitiesView() {
  // Local state for filters and view
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [needsPlanFilter, setNeedsPlanFilter] = useState(false);
  const [hasUnlinkedFilter, setHasUnlinkedFilter] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");

  // Build query params based on filters
  const queryParams = {
    category: activeTab === "all" ? undefined : activeTab,
    needsPlanAssociation: needsPlanFilter || undefined,
    hasUnlinkedDistricts: hasUnlinkedFilter || undefined,
  };

  const { data, isLoading, error } = useActivities(queryParams);
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  // Handle updating an activity
  const handleUpdateActivity = async (formData: ActivityFormData) => {
    if (!editingActivity) return;
    await updateActivity.mutateAsync({
      activityId: editingActivity.id,
      type: formData.type,
      title: formData.title,
      startDate: formData.startDate ? new Date(formData.startDate).toISOString() : null,
      endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
      status: formData.status,
      notes: formData.notes || undefined,
    });
  };

  // Handle deleting an activity
  const handleDeleteActivity = async (activityId: string) => {
    if (confirm("Are you sure you want to delete this activity?")) {
      await deleteActivity.mutateAsync(activityId);
    }
  };

  // Open edit modal
  const handleEditClick = (activity: ActivityListItem) => {
    setEditingActivity(activity);
  };

  // Close edit modal
  const handleCloseEditModal = () => {
    setEditingActivity(null);
  };

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Activities</h1>
            <p className="text-sm text-gray-500">
              Manage your sales activities across all territory plans
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ViewToggle view={view} onViewChange={setView} />
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              New Activity
            </button>
          </div>
        </div>
      </header>

      {/* Category Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <nav className="flex gap-6">
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-[#F37167] text-[#403770]"
                    : "border-transparent text-gray-500 hover:text-[#403770] hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Filters Row */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-3">
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={needsPlanFilter}
                onChange={(e) => setNeedsPlanFilter(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#F37167] focus:ring-[#F37167]"
              />
              Needs Plan
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={hasUnlinkedFilter}
                onChange={(e) => setHasUnlinkedFilter(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#F37167] focus:ring-[#F37167]"
              />
              Has Unlinked Districts
            </label>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
              <p className="text-[#403770] font-medium">Loading activities...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-red-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-medium mb-1">Error loading activities</p>
              <p className="text-sm">{error.message}</p>
            </div>
          </div>
        ) : data && data.activities.length > 0 ? (
          view === "cards" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.activities.map((activity) => {
                const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];
                const typeLabel = ACTIVITY_TYPE_LABELS[activity.type];
                const typeIcon = ACTIVITY_TYPE_ICONS[activity.type];

                return (
                  <div
                    key={activity.id}
                    className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                  >
                    {/* Card Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <span className="text-2xl">{typeIcon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[#403770] truncate">
                          {activity.title}
                        </h3>
                        <p className="text-sm text-gray-500">{typeLabel}</p>
                      </div>
                      <span
                        className="px-2 py-0.5 text-xs font-medium rounded-full"
                        style={{
                          backgroundColor: statusConfig.bgColor,
                          color: statusConfig.color,
                        }}
                      >
                        {statusConfig.label}
                      </span>
                    </div>

                    {/* Date Range */}
                    <div className="text-sm text-gray-600 mb-3">
                      {formatDateRange(activity.startDate, activity.endDate)}
                    </div>

                    {/* Warning Badges */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {activity.needsPlanAssociation && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Needs Plan
                        </span>
                      )}
                      {activity.hasUnlinkedDistricts && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-700">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Unlinked Districts
                        </span>
                      )}
                    </div>

                    {/* Footer Counts */}
                    <div className="flex items-center gap-4 text-xs text-gray-500 border-t border-gray-100 pt-3">
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                        {activity.planCount} plan{activity.planCount !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                        {activity.districtCount} district{activity.districtCount !== 1 ? "s" : ""}
                      </span>
                      {activity.stateAbbrevs.length > 0 && (
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          {activity.stateAbbrevs.slice(0, 3).join(", ")}
                          {activity.stateAbbrevs.length > 3 && ` +${activity.stateAbbrevs.length - 3}`}
                        </span>
                      )}
                      {/* Action buttons */}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditClick(activity);
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#403770] hover:bg-gray-100 rounded transition-colors"
                          title="Edit activity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteActivity(activity.id);
                          }}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                          title="Delete activity"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <ActivitiesTable
              activities={data.activities}
              onEdit={handleEditClick}
              onDelete={handleDeleteActivity}
              isDeleting={deleteActivity.isPending}
            />
          )
        ) : (
          <div className="text-center py-20">
            <svg
              className="w-20 h-20 mx-auto text-gray-300 mb-6"
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
            <h2 className="text-xl font-semibold text-gray-600 mb-2">
              No activities yet
            </h2>
            <p className="text-gray-500 max-w-md mx-auto mb-6">
              Create your first activity to start tracking conferences, outreach campaigns, and sales meetings.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Your First Activity
            </button>
          </div>
        )}
      </main>

      {/* Activity Form Modal (Create) */}
      <ActivityFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultCategory={activeTab === "all" ? undefined : activeTab}
      />

      {/* Edit Activity Modal */}
      {editingActivity && (
        <EditActivityFormModal
          isOpen={!!editingActivity}
          onClose={handleCloseEditModal}
          onSubmit={handleUpdateActivity}
          districts={[]}
          initialData={editingActivity}
          title="Edit Activity"
        />
      )}
    </div>
  );
}
