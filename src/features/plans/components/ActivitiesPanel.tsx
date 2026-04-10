"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useUnlinkActivityPlan,
  useDistrictDetail,
  type ActivityListItem,
  type TerritoryPlanDistrict,
} from "@/lib/api";
import ActivityCard from "./ActivityCard";
import ActivityFormModal, { type ActivityFormData } from "./ActivityFormModal";
import ActivitySearchModal from "./ActivitySearchModal";
import ViewToggle from "@/features/shared/components/ViewToggle";
import ActivitiesTable from "./ActivitiesTable";

interface ActivitiesPanelProps {
  planId: string;
  planName?: string;
  // Districts in this plan (for the activity form dropdown)
  districts: TerritoryPlanDistrict[];
}

export default function ActivitiesPanel({ planId, planName, districts }: ActivitiesPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);
  // Track which district is selected in the form to fetch its contacts
  const [selectedDistrictLeaid, setSelectedDistrictLeaid] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch activities for this plan using the new Activity system
  const { data: activitiesResponse, isLoading } = useActivities({ planId });
  const activities = activitiesResponse?.activities;

  // Mutations using the new Activity system
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const unlinkActivityPlan = useUnlinkActivityPlan();

  // Fetch contacts for the selected district (for the form)
  const { data: districtDetail } = useDistrictDetail(selectedDistrictLeaid);
  const contacts = districtDetail?.contacts || [];

  // District options for the form dropdown
  const districtOptions = useMemo(
    () =>
      districts.map((d) => ({
        leaid: d.leaid,
        name: d.name,
        stateAbbrev: d.stateAbbrev,
      })),
    [districts]
  );

  // Set of activity IDs already linked to this plan
  const linkedActivityIds = useMemo(
    () => new Set(activities?.map((a) => a.id) ?? []),
    [activities]
  );

  // Calculate stats
  const stats = useMemo(() => {
    if (!activities) return { planned: 0, completed: 0, total: 0 };
    const planned = activities.filter((a) => a.status === "planned").length;
    const completed = activities.filter((a) => a.status === "completed").length;
    return { planned, completed, total: activities.length };
  }, [activities]);

  // Handle creating a new activity
  const handleCreateActivity = async (data: ActivityFormData) => {
    await createActivity.mutateAsync({
      type: data.type,
      title: data.title,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      status: data.status,
      planIds: [planId], // Link to this plan
      districtLeaids: data.districtLeaid ? [data.districtLeaid] : undefined,
      contactIds: data.contactIds.length > 0 ? data.contactIds : undefined,
      notes: data.notes || undefined,
    });
  };

  // Handle updating an activity
  const handleUpdateActivity = async (data: ActivityFormData) => {
    if (!editingActivity) return;
    await updateActivity.mutateAsync({
      activityId: editingActivity.id,
      type: data.type,
      title: data.title,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      status: data.status,
      notes: data.notes || undefined,
    });
  };

  // Handle deleting an activity
  const handleDeleteActivity = async (activityId: string) => {
    await deleteActivity.mutateAsync(activityId);
  };

  // Handle unlinking an activity from this plan
  const handleUnlinkActivity = useCallback(
    async (activityId: string) => {
      await unlinkActivityPlan.mutateAsync({ activityId, planId });
    },
    [unlinkActivityPlan, planId]
  );

  // Open edit modal with selected activity
  const handleEditClick = (activity: ActivityListItem) => {
    // Note: ActivityListItem doesn't include district details, so we clear selection
    // The form will show the activity data but districts are handled separately in the new system
    setSelectedDistrictLeaid(null);
    setEditingActivity(activity);
  };

  // Close modals
  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingActivity(null);
    setSelectedDistrictLeaid(null);
  };

  // Watch for district selection changes in the form
  const handleDistrictChange = (leaid: string | null) => {
    setSelectedDistrictLeaid(leaid);
  };

  // Close dropdown on outside click
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDropdown]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#403770]">Activities</h2>
          {/* Quick stats */}
          {stats.total > 0 && (
            <p className="text-sm text-gray-500">
              {stats.planned > 0 && (
                <span className="text-[#6EA3BE]">{stats.planned} planned</span>
              )}
              {stats.planned > 0 && stats.completed > 0 && <span> • </span>}
              {stats.completed > 0 && (
                <span className="text-[#8AA891]">{stats.completed} completed</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <ViewToggle view={view} onViewChange={(v) => setView(v as "cards" | "table")} />

          {/* Add dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowDropdown((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#352d5c] rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add
              <svg className="w-3 h-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-1 w-48 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden z-20">
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setShowSearchModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left"
                >
                  <svg className="w-4 h-4 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" strokeWidth="2" />
                    <path d="m21 21-4.35-4.35" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Link Existing
                </button>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    setSelectedDistrictLeaid(null);
                    setEditingActivity(null);
                    setShowAddModal(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-[#403770] hover:bg-[#F7F5FA] transition-colors text-left border-t border-[#F7F5FA]"
                >
                  <svg className="w-4 h-4 text-[#8A80A8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create New
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity list */}
      <div className="flex-1 overflow-y-auto space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#403770] border-t-transparent" />
          </div>
        ) : activities && activities.length > 0 ? (
          view === "cards" ? (
            activities.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                onEdit={() => handleEditClick(activity)}
                onDelete={() => handleDeleteActivity(activity.id)}
                onUnlink={() => handleUnlinkActivity(activity.id)}
                isDeleting={deleteActivity.isPending}
              />
            ))
          ) : (
            <ActivitiesTable
              activities={activities}
              onEdit={handleEditClick}
              onDelete={handleDeleteActivity}
              onUnlink={handleUnlinkActivity}
              isDeleting={deleteActivity.isPending}
            />
          )
        ) : (
          <div className="text-center py-12">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-300"
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
            <p className="text-gray-500 mb-2">No activities yet</p>
            <p className="text-sm text-gray-400">
              Track your sales activities like visits,<br />meetings, and email campaigns
            </p>
          </div>
        )}
      </div>

      {/* Add Activity Modal */}
      <ActivityFormModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSubmit={handleCreateActivity}
        districts={districtOptions}
        contacts={contacts}
        title="Add Activity"
      />

      {/* Edit Activity Modal */}
      {editingActivity && (
        <ActivityFormModal
          isOpen={!!editingActivity}
          onClose={handleCloseModal}
          onSubmit={handleUpdateActivity}
          onDelete={handleDeleteActivity}
          districts={districtOptions}
          contacts={contacts}
          initialData={editingActivity}
          title="Edit Activity"
        />
      )}

      {/* Activity Search Modal */}
      <ActivitySearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        planId={planId}
        planName={planName}
        linkedActivityIds={linkedActivityIds}
      />
    </div>
  );
}
