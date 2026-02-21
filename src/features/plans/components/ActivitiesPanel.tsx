"use client";

import { useState, useMemo } from "react";
import {
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useDistrictDetail,
  type ActivityListItem,
  type TerritoryPlanDistrict,
} from "@/lib/api";
import ActivityCard from "./ActivityCard";
import ActivityFormModal, { type ActivityFormData } from "./ActivityFormModal";
import ViewToggle from "@/features/shared/components/ViewToggle";
import ActivitiesTable from "./ActivitiesTable";

interface ActivitiesPanelProps {
  planId: string;
  // Districts in this plan (for the activity form dropdown)
  districts: TerritoryPlanDistrict[];
}

export default function ActivitiesPanel({ planId, districts }: ActivitiesPanelProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);
  // Track which district is selected in the form to fetch its contacts
  const [selectedDistrictLeaid, setSelectedDistrictLeaid] = useState<string | null>(null);
  const [view, setView] = useState<"cards" | "table">("cards");

  // Fetch activities for this plan using the new Activity system
  const { data: activitiesResponse, isLoading } = useActivities({ planId });
  const activities = activitiesResponse?.activities;

  // Mutations using the new Activity system
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

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

  // Open edit modal with selected activity
  const handleEditClick = (activity: ActivityListItem) => {
    // Note: ActivityListItem doesn't include district details, so we clear selection
    // The form will show the activity data but districts are handled separately in the new system
    setSelectedDistrictLeaid(null);
    setEditingActivity(activity);
  };

  // Open add modal
  const handleAddClick = () => {
    setSelectedDistrictLeaid(null);
    setEditingActivity(null);
    setShowAddModal(true);
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
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#352d5c] rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add
          </button>
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
                isDeleting={deleteActivity.isPending}
              />
            ))
          ) : (
            <ActivitiesTable
              activities={activities}
              onEdit={handleEditClick}
              onDelete={handleDeleteActivity}
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
          districts={districtOptions}
          contacts={contacts}
          initialData={editingActivity}
          title="Edit Activity"
        />
      )}
    </div>
  );
}
