"use client";

import { useState, useMemo, useCallback } from "react";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
} from "date-fns";
import {
  useActivities,
  useUpdateActivity,
  useDeleteActivity,
  useActivityMetrics,
  useCalendarConnection,
  useTriggerCalendarSync,
  type ActivityListItem,
} from "@/lib/api";
import {
  type ActivityCategory,
  type ActivityStatus,
  VALID_ACTIVITY_STATUSES,
  ACTIVITY_STATUS_CONFIG,
  CATEGORY_LABELS,
} from "@/lib/activityTypes";
import ActivityFormModal from "@/components/activities/ActivityFormModal";
import EditActivityFormModal, { type ActivityFormData } from "@/features/plans/components/ActivityFormModal";
import ActivitiesTable from "@/features/plans/components/ActivitiesTable";
import CalendarView from "@/components/activities/CalendarView";
import CalendarInbox from "@/components/calendar/CalendarInbox";

type CategoryTab = "all" | ActivityCategory;
type ViewMode = "table" | "calendar";
type StatusFilter = "all" | ActivityStatus;

// Stable empty params object to avoid new reference each render
const EMPTY_PARAMS = {};

const selectStyle =
  "h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";

export default function ActivitiesView() {
  const [activeTab, setActiveTab] = useState<CategoryTab>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [needsPlanFilter, setNeedsPlanFilter] = useState(false);
  const [hasUnlinkedFilter, setHasUnlinkedFilter] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [calendarDate, setCalendarDate] = useState(new Date());

  const isCalendar = view === "calendar";

  // Build query params based on filters
  const queryParams = useMemo(() => ({
    category: activeTab === "all" ? undefined : activeTab,
    status: statusFilter === "all" ? undefined : statusFilter,
    needsPlanAssociation: needsPlanFilter || undefined,
    hasUnlinkedDistricts: hasUnlinkedFilter || undefined,
    ...(isCalendar
      ? {
          startDateFrom: format(subMonths(startOfMonth(calendarDate), 1), "yyyy-MM-dd"),
          startDateTo: format(endOfMonth(addMonths(calendarDate, 1)), "yyyy-MM-dd"),
        }
      : {}),
  }), [activeTab, statusFilter, needsPlanFilter, hasUnlinkedFilter, isCalendar, calendarDate]);

  const { data, isLoading, error } = useActivities(queryParams);

  // Fetch unscheduled activities (only when calendar is active)
  const unscheduledParams = useMemo(() => ({
    category: activeTab === "all" ? undefined : activeTab,
    unscheduled: true as const,
  }), [activeTab]);

  const { data: unscheduledData } = useActivities(
    isCalendar ? unscheduledParams : EMPTY_PARAMS
  );
  const unscheduledActivities = isCalendar
    ? unscheduledData?.activities || []
    : [];

  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const { data: calendarConnectionData } = useCalendarConnection();
  const calendarSyncMutation = useTriggerCalendarSync();
  const isCalendarConnected = calendarConnectionData?.connected;

  // Activity metrics for the summary bar (month view)
  const { data: metrics } = useActivityMetrics("month");

  // Client-side search filtering
  const filteredActivities = useMemo(() => {
    if (!data?.activities || !searchQuery.trim()) return data?.activities || [];
    const query = searchQuery.toLowerCase().trim();
    return data.activities.filter((a) => a.title.toLowerCase().includes(query));
  }, [data?.activities, searchQuery]);

  const hasActiveFilters =
    activeTab !== "all" ||
    statusFilter !== "all" ||
    needsPlanFilter ||
    hasUnlinkedFilter ||
    searchQuery.trim().length > 0;

  // Handle updating an activity
  const handleUpdateActivity = useCallback(async (formData: ActivityFormData) => {
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
  }, [editingActivity, updateActivity]);

  // Handle deleting an activity
  const handleDeleteActivity = useCallback(async (activityId: string) => {
    if (confirm("Are you sure you want to delete this activity?")) {
      await deleteActivity.mutateAsync(activityId);
    }
  }, [deleteActivity]);

  // Open edit modal
  const handleEditClick = useCallback((activity: ActivityListItem) => {
    setEditingActivity(activity);
  }, []);

  // Close edit modal
  const handleCloseEditModal = useCallback(() => {
    setEditingActivity(null);
  }, []);

  return (
    <div className={`h-full overflow-auto bg-[#FFFCFA] ${isCalendar ? "flex flex-col" : ""}`}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className={`${isCalendar ? "" : "max-w-6xl mx-auto"}`}>
          <h1 className="text-xl font-bold text-[#403770]">Activities</h1>
          <p className="text-sm text-gray-500">
            Manage your sales activities across all territory plans
          </p>
        </div>
      </header>

      {/* Content */}
      {isCalendar ? (
        <>
          {/* Calendar top bar — just a back-to-table link, the "New Activity"
              button now lives in the CalendarView right panel */}
          <div className="px-6 py-2 bg-white border-b border-gray-200 flex items-center gap-3">
            <button
              onClick={() => setView("table")}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#403770] hover:text-[#F37167] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Table View
            </button>
          </div>
          <div className="flex-1 min-h-0">
            {error ? (
              <div className="flex items-center justify-center py-20">
                <div className="text-center text-red-500">
                  <p className="font-medium mb-1">Error loading calendar</p>
                  <p className="text-sm mb-3">{error.message}</p>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
                  >
                    Reload
                  </button>
                </div>
              </div>
            ) : (
              <CalendarView
                activities={data?.activities || []}
                isLoading={isLoading}
                onEditActivity={handleEditClick}
                onDeleteActivity={handleDeleteActivity}
                unscheduledActivities={unscheduledActivities}
                onNewActivity={() => setIsModalOpen(true)}
              />
            )}
          </div>
        </>
      ) : (
        <main className="max-w-6xl mx-auto px-6 py-6">
          {/* Calendar Inbox — shows pending synced events at the top */}
          <CalendarInbox />

          {/* Summary bar — inline metrics for the current month */}
          {metrics && metrics.totalActivities > 0 && (
            <div className="flex items-center flex-wrap gap-2 mb-3 px-3 py-2 bg-gray-50 rounded-lg text-[12px] text-gray-500">
              <span className="font-medium text-[#403770]">
                This month:
              </span>
              <span>{metrics.totalActivities} activities</span>
              <span className="text-gray-300">&middot;</span>
              <span>{metrics.bySource.calendar_sync} from calendar</span>
              <span className="text-gray-300">&middot;</span>
              <span>{metrics.bySource.manual} manual</span>
              {metrics.byStatus.completed > 0 && (
                <>
                  <span className="text-gray-300">&middot;</span>
                  <span className="text-[#8AA891]">{metrics.byStatus.completed} completed</span>
                </>
              )}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center flex-wrap gap-2 mb-3">
            {/* Category dropdown */}
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as CategoryTab)}
              className={selectStyle}
            >
              <option value="all">All Categories</option>
              {(Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>

            {/* Status dropdown */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className={selectStyle}
            >
              <option value="all">All Statuses</option>
              {VALID_ACTIVITY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ACTIVITY_STATUS_CONFIG[s].label}
                </option>
              ))}
            </select>

            {/* Needs Plan toggle */}
            <button
              onClick={() => setNeedsPlanFilter(!needsPlanFilter)}
              className={`h-9 px-3 text-sm font-medium rounded-md border transition-colors ${
                needsPlanFilter
                  ? "bg-[#403770] text-white border-[#403770]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              Needs Plan
            </button>

            {/* Unlinked Districts toggle */}
            <button
              onClick={() => setHasUnlinkedFilter(!hasUnlinkedFilter)}
              className={`h-9 px-3 text-sm font-medium rounded-md border transition-colors ${
                hasUnlinkedFilter
                  ? "bg-[#403770] text-white border-[#403770]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
              }`}
            >
              Unlinked
            </button>

            {/* Search input */}
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 pr-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] placeholder:text-gray-400 w-52"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Scan Calendar button — only when calendar is connected */}
            {isCalendarConnected && (
              <button
                onClick={() => calendarSyncMutation.mutate()}
                disabled={calendarSyncMutation.isPending}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-md hover:border-gray-300 hover:text-[#403770] transition-colors disabled:opacity-50"
              >
                <svg
                  className={`w-4 h-4 ${calendarSyncMutation.isPending ? "animate-spin" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {calendarSyncMutation.isPending ? "Scanning..." : "Scan Calendar"}
              </button>
            )}

            {/* Calendar toggle */}
            <button
              onClick={() => setView("calendar")}
              className="h-9 px-2.5 text-gray-500 hover:text-[#403770] border border-gray-200 rounded-md hover:border-gray-300 transition-colors"
              title="Calendar view"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>

            {/* New Activity button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Activity
            </button>
          </div>

          {/* Table content */}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-medium mb-1">Error loading activities</p>
                <p className="text-sm">{error.message}</p>
              </div>
            </div>
          ) : filteredActivities.length > 0 ? (
            <ActivitiesTable
              activities={filteredActivities}
              onEdit={handleEditClick}
              onDelete={handleDeleteActivity}
              isDeleting={deleteActivity.isPending}
            />
          ) : (
            <div className="text-center py-20">
              {hasActiveFilters ? (
                <>
                  <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-gray-600 mb-2">
                    No activities match your filters
                  </h2>
                  <p className="text-gray-500 text-sm">
                    Try adjusting your filters or search query.
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-20 h-20 mx-auto text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create Your First Activity
                  </button>
                </>
              )}
            </div>
          )}
        </main>
      )}

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
