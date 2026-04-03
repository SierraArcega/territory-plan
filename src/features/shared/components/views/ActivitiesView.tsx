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
  useDeleteActivity,
  useActivityMetrics,
  useCalendarConnection,
  useTriggerCalendarSync,
  useProfile,
  type ActivityListItem,
} from "@/lib/api";
import { useUsers } from "@/features/shared/lib/queries";
import {
  type ActivityCategory,
  type ActivityStatus,
  VALID_ACTIVITY_STATUSES,
  ACTIVITY_STATUS_CONFIG,
  CATEGORY_LABELS,
} from "@/features/activities/types";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import FilterBar, { type FilterConfig, type FilterOption } from "@/features/plans/components/FilterBar";
import ActivitiesTable from "@/features/plans/components/ActivitiesTable";
import CalendarView from "@/features/activities/components/CalendarView";
import UnlinkedActivityBadge from "@/features/activities/components/UnlinkedActivityBadge";
import UnlinkedActivityTriage from "@/features/activities/components/UnlinkedActivityTriage";

type ViewMode = "table" | "calendar";

// Stable empty params object to avoid new reference each render
const EMPTY_PARAMS = {};

// Build filter configs
const CATEGORY_OPTIONS: FilterOption[] = (Object.keys(CATEGORY_LABELS) as ActivityCategory[]).map((cat) => ({
  value: cat,
  label: CATEGORY_LABELS[cat],
}));

const STATUS_OPTIONS: FilterOption[] = VALID_ACTIVITY_STATUSES.map((s) => ({
  value: s,
  label: ACTIVITY_STATUS_CONFIG[s].label,
}));

const SORT_OPTIONS: FilterOption[] = [
  { value: "startDate", label: "Date" },
  { value: "title", label: "Title" },
  { value: "type", label: "Type" },
  { value: "status", label: "Status" },
];

const GROUP_OPTIONS: FilterOption[] = [
  { value: "none", label: "No grouping" },
  { value: "category", label: "Category" },
  { value: "status", label: "Status" },
  { value: "owner", label: "Owner" },
];

export default function ActivitiesView() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTriageOpen, setIsTriageOpen] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("table");
  const [calendarDate, setCalendarDate] = useState(new Date());

  // FilterBar state
  const [activeFilters, setActiveFilters] = useState<Record<string, string | string[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentSort, setCurrentSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "startDate", direction: "desc" });
  const [currentGroup, setCurrentGroup] = useState("none");

  const { data: profile } = useProfile();
  const { data: users } = useUsers();

  const isCalendar = view === "calendar";

  // Build owner filter options — current user first, then "All", then others
  const ownerOptions = useMemo((): FilterOption[] => {
    if (!users || !profile) return [];
    const me = users.find((u) => u.id === profile.id);
    const others = users.filter((u) => u.id !== profile.id);
    return [
      ...(me ? [{ value: me.id, label: `${me.fullName || me.email} (Me)` }] : []),
      { value: "all", label: "Everyone" },
      ...others.map((u) => ({ value: u.id, label: u.fullName || u.email })),
    ];
  }, [users, profile]);

  // Build filter configs with dynamic owner options
  const filterConfigs = useMemo((): FilterConfig[] => [
    { id: "category", label: "Category", type: "select", options: CATEGORY_OPTIONS },
    { id: "status", label: "Status", type: "select", options: STATUS_OPTIONS },
    { id: "owner", label: "Rep", type: "select", options: ownerOptions },
    { id: "needsPlan", label: "Needs Plan", type: "select", options: [{ value: "true", label: "Yes" }] },
  ], [ownerOptions]);

  // Derive query params from FilterBar state
  const queryParams = useMemo(() => {
    const ownerFilter = activeFilters.owner as string | undefined;
    // Default to current user if no owner filter set
    const ownerId = ownerFilter === "all" ? "all" : ownerFilter || undefined;

    return {
      category: (activeFilters.category as ActivityCategory) || undefined,
      status: (activeFilters.status as ActivityStatus) || undefined,
      needsPlanAssociation: activeFilters.needsPlan === "true" || undefined,
      ownerId,
      ...(isCalendar
        ? {
            startDateFrom: format(subMonths(startOfMonth(calendarDate), 1), "yyyy-MM-dd"),
            startDateTo: format(endOfMonth(addMonths(calendarDate, 1)), "yyyy-MM-dd"),
          }
        : {}),
    };
  }, [activeFilters, isCalendar, calendarDate]);

  const { data, isLoading, error } = useActivities(queryParams);

  // Fetch unscheduled activities (only when calendar is active)
  const unscheduledParams = useMemo(() => ({
    category: (activeFilters.category as string) || undefined,
    unscheduled: true as const,
  }), [activeFilters.category]);

  const { data: unscheduledData } = useActivities(
    isCalendar ? unscheduledParams : EMPTY_PARAMS
  );
  const unscheduledActivities = isCalendar
    ? unscheduledData?.activities || []
    : [];

  const deleteActivity = useDeleteActivity();
  const { data: calendarConnectionData } = useCalendarConnection();
  const calendarSyncMutation = useTriggerCalendarSync();
  const isCalendarConnected = calendarConnectionData?.connected;

  // Activity metrics for the summary bar (month view)
  const { data: metrics } = useActivityMetrics("month");

  // Client-side search filtering
  const filteredActivities = useMemo(() => {
    if (!data?.activities || !searchTerm.trim()) return data?.activities || [];
    const query = searchTerm.toLowerCase().trim();
    return data.activities.filter((a) => a.title.toLowerCase().includes(query));
  }, [data?.activities, searchTerm]);

  const hasActiveFilters =
    Object.keys(activeFilters).some(
      (k) => activeFilters[k] && (Array.isArray(activeFilters[k]) ? (activeFilters[k] as string[]).length > 0 : true)
    ) || searchTerm.trim().length > 0;

  // Handle deleting an activity
  const handleDeleteActivity = useCallback(async (activityId: string) => {
    if (confirm("Are you sure you want to delete this activity?")) {
      await deleteActivity.mutateAsync(activityId);
    }
  }, [deleteActivity]);

  // Open edit modal
  const handleEditClick = useCallback((activity: ActivityListItem) => {
    setEditingActivityId(activity.id);
  }, []);

  // Close edit modal
  const handleCloseEditModal = useCallback(() => {
    setEditingActivityId(null);
  }, []);

  return (
    <div className={`h-full overflow-auto bg-[#FFFCFA] ${isCalendar ? "flex flex-col" : ""}`}>
      {/* Header */}
      <header className="bg-white border-b border-[#E2DEEC] px-6 py-4">
        <div className={`${isCalendar ? "" : "max-w-6xl mx-auto"}`}>
          <h1 className="text-xl font-bold text-[#403770]">Activities</h1>
          <p className="text-sm text-[#8A80A8]">
            Manage your sales activities across all territory plans
          </p>
        </div>
      </header>

      {/* Content */}
      {isCalendar ? (
        <>
          <div className="px-6 py-2 bg-white border-b border-[#E2DEEC] flex items-center gap-3">
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
          {/* Summary bar */}
          {metrics && metrics.totalActivities > 0 && (
            <div className="flex items-center flex-wrap gap-2 mb-4 px-3 py-2 bg-[#F7F5FA] rounded-lg text-xs text-[#8A80A8]">
              <span className="font-medium text-[#403770]">This month:</span>
              <span>{metrics.totalActivities} activities</span>
              <span className="text-[#D4CFE2]">&middot;</span>
              <span>{metrics.bySource.calendar_sync} from calendar</span>
              <span className="text-[#D4CFE2]">&middot;</span>
              <span>{metrics.bySource.manual} manual</span>
              {metrics.byStatus.completed > 0 && (
                <>
                  <span className="text-[#D4CFE2]">&middot;</span>
                  <span className="text-[#8AA891]">{metrics.byStatus.completed} completed</span>
                </>
              )}
            </div>
          )}

          {/* Standard FilterBar */}
          <div className="mb-4 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <FilterBar
                filters={filterConfigs}
                activeFilters={activeFilters}
                onFilterChange={setActiveFilters}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                sortOptions={SORT_OPTIONS}
                currentSort={currentSort}
                onSortChange={setCurrentSort}
                groupOptions={GROUP_OPTIONS}
                currentGroup={currentGroup}
                onGroupChange={setCurrentGroup}
                savedViews={[]}
                onSaveView={() => {}}
                onLoadView={() => {}}
                onDeleteView={() => {}}
              />
            </div>

            {/* Right-side actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Scan Calendar */}
              {isCalendarConnected && (
                <button
                  onClick={() => calendarSyncMutation.mutate()}
                  disabled={calendarSyncMutation.isPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
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
                  {calendarSyncMutation.isPending ? "Scanning..." : "Scan"}
                </button>
              )}

              {/* Calendar toggle */}
              <button
                onClick={() => setView("calendar")}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                title="Calendar view"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>

              {/* Unlinked badge */}
              <UnlinkedActivityBadge onClick={() => setIsTriageOpen(true)} />

              {/* New Activity */}
              <button
                onClick={() => setIsModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Activity
              </button>
            </div>
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
                  <svg className="w-12 h-12 mx-auto text-[#C2BBD4] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <h2 className="text-base font-semibold text-[#6E6390] mb-1">
                    No activities match your filters
                  </h2>
                  <p className="text-[#8A80A8] text-sm">
                    Try adjusting your filters or search query.
                  </p>
                </>
              ) : (
                <>
                  <svg className="w-16 h-16 mx-auto text-[#C2BBD4] mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <h2 className="text-lg font-semibold text-[#6E6390] mb-2">
                    No activities yet
                  </h2>
                  <p className="text-[#8A80A8] max-w-md mx-auto mb-6">
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
        defaultCategory={(activeFilters.category as ActivityCategory) || undefined}
      />

      {/* Edit Activity Modal */}
      {editingActivityId && (
        <ActivityFormModal
          isOpen={!!editingActivityId}
          onClose={handleCloseEditModal}
          editActivityId={editingActivityId}
        />
      )}

      {/* Unlinked Activity Triage Drawer */}
      <UnlinkedActivityTriage
        isOpen={isTriageOpen}
        onClose={() => setIsTriageOpen(false)}
      />
    </div>
  );
}
