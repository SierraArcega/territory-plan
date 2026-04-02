"use client";

import { useState, useEffect, useMemo } from "react";
import { useActivity, useUpdateActivity } from "@/features/activities/lib/queries";
import { useStates, useTerritoryPlans } from "@/lib/api";
import {
  ACTIVITY_STATUS_CONFIG,
  getCategoryForType,
  getStatusesForType,
  type ActivityType,
  type ActivityStatus,
} from "@/features/activities/types";
import EventTypeFields from "./event-fields/EventTypeFields";
import CalendarPicker from "./event-fields/CalendarPicker";
import StatusSelect from "./event-fields/StatusSelect";
import AttendeeSelect from "./event-fields/AttendeeSelect";
import { MultiSelect } from "@/features/shared/components/MultiSelect";
import ActivityFormTabs from "./ActivityFormTabs";
import { type TaskDraft } from "./event-fields/TaskLineItems";
import { type RelationDraft } from "./tabs/RelatedActivitiesTab";

interface ActivityViewPanelProps {
  activityId: string;
  onViewRelated: (activityId: string, title: string) => void;
}

export default function ActivityViewPanel({ activityId, onViewRelated }: ActivityViewPanelProps) {
  const { data: activity, isLoading } = useActivity(activityId);
  const updateActivity = useUpdateActivity();
  const { data: plans } = useTerritoryPlans({});
  const { data: states } = useStates({});

  // Local form state — populated from fetched activity
  const [title, setTitle] = useState("");
  const [type, setType] = useState<ActivityType>("conference");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [status, setStatus] = useState<ActivityStatus>("planned");
  const [notes, setNotes] = useState("");
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [attendeeUserIds, setAttendeeUserIds] = useState<string[]>([]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
  const [districtStops, setDistrictStops] = useState<
    { leaid: string; name: string; stateAbbrev: string | null; visitDate: string; notes: string }[]
  >([]);
  const [taskDrafts, setTaskDrafts] = useState<TaskDraft[]>([]);
  const [expenses, setExpenses] = useState<{ description: string; amount: number }[]>([]);
  const [relatedActivities, setRelatedActivities] = useState<RelationDraft[]>([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Populate form from fetched activity
  useEffect(() => {
    if (!activity) return;
    setTitle(activity.title);
    setType(activity.type);
    setStartDate(activity.startDate?.split("T")[0] || "");
    setEndDate(activity.endDate?.split("T")[0] || "");
    setIsMultiDay(!!activity.endDate);
    setStatus(activity.status);
    setNotes(activity.notes || "");
    setMetadata((activity.metadata as Record<string, unknown>) || {});
    setAttendeeUserIds(activity.attendees.map((a) => a.userId));
    setSelectedPlanIds(activity.plans.map((p) => p.planId));
    setSelectedStateFips(activity.states.map((s) => s.fips));
    setExpenses(activity.expenses.map((e) => ({ description: e.description, amount: e.amount })));
    setRelatedActivities(
      activity.relatedActivities.map((r) => ({
        activityId: r.activityId,
        title: r.title,
        type: r.type,
        startDate: r.startDate,
        status: r.status,
        relationType: r.relationType,
      }))
    );
    setHasChanges(false);
  }, [activity]);

  const planOptions = useMemo(() => (plans ?? []).map((p) => ({ value: p.id, label: p.name })), [plans]);
  const stateOptions = useMemo(() => (states ?? []).map((s) => ({ value: s.fips, label: `${s.name} (${s.abbrev})` })), [states]);
  const isEventCategory = getCategoryForType(type) === "events";

  // Mark changes
  const markChanged = () => setHasChanges(true);

  const handleSave = async () => {
    if (!title.trim()) return;
    const isEvent = getCategoryForType(type) === "events";
    const hasMetadata = isEvent && Object.keys(metadata).length > 0;

    await updateActivity.mutateAsync({
      activityId,
      title: title.trim(),
      startDate: startDate || null,
      endDate: isMultiDay && endDate ? endDate : null,
      status,
      notes: notes.trim() || null,
      metadata: hasMetadata ? metadata : null,
      attendeeUserIds,
      expenses: expenses.filter((e) => e.description.trim()),
    });
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <span className="w-5 h-5 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <p className="text-sm text-[#A69DC0]">Activity not found</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-1/2 overflow-y-auto p-5 space-y-5">
          <div>
            <label className="block text-xs font-medium text-[#8A80A8] mb-1">
              Title <span className="text-[#F37167]">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); markChanged(); }}
              className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CalendarPicker
              startDate={startDate}
              endDate={endDate}
              isMultiDay={isMultiDay}
              onStartDateChange={(v) => { setStartDate(v); markChanged(); }}
              onEndDateChange={(v) => { setEndDate(v); markChanged(); }}
              onMultiDayChange={(v) => { setIsMultiDay(v); markChanged(); }}
            />
            <StatusSelect
              status={status}
              onChange={(v) => { setStatus(v); markChanged(); }}
              statuses={getStatusesForType(type)}
            />
          </div>

          {isEventCategory && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">Details</p>
              <EventTypeFields
                type={type}
                metadata={metadata}
                onMetadataChange={(v) => { setMetadata(v); markChanged(); }}
                districtStops={districtStops}
                onDistrictStopsChange={(v) => { setDistrictStops(v); markChanged(); }}
              />
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">People & Organization</p>
            {isEventCategory && (
              <div>
                <label className="block text-xs font-medium text-[#8A80A8] mb-1">Attendees</label>
                <AttendeeSelect selectedUserIds={attendeeUserIds} onChange={(v) => { setAttendeeUserIds(v); markChanged(); }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#8A80A8] mb-1">Plans</label>
                <MultiSelect id={`view-plans-${activityId}`} label="Plans" options={planOptions} selected={selectedPlanIds} onChange={(v) => { setSelectedPlanIds(v); markChanged(); }} placeholder="Select..." countLabel="plans" searchPlaceholder="Search plans..." />
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-medium text-[#8A80A8] mb-1">States</label>
                <MultiSelect id={`view-states-${activityId}`} label="States" options={stateOptions} selected={selectedStateFips} onChange={(v) => { setSelectedStateFips(v); markChanged(); }} placeholder="Select..." countLabel="states" searchPlaceholder="Search states..." />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#8A80A8] mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => { setNotes(e.target.value); markChanged(); }}
                placeholder="Add any notes or details..."
                rows={2}
                className="w-full px-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right Panel — Tabs */}
        <div className="w-1/2 border-l border-[#E2DEEC] flex flex-col">
          <ActivityFormTabs
            taskDrafts={taskDrafts}
            onTaskDraftsChange={setTaskDrafts}
            expenses={expenses}
            onExpensesChange={(v) => { setExpenses(v); markChanged(); }}
            relatedActivities={relatedActivities}
            onRelatedActivitiesChange={(v) => { setRelatedActivities(v); markChanged(); }}
            onViewActivity={onViewRelated}
          />
        </div>
      </div>

      {/* Save footer — only shows when changes detected */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-3 px-6 py-3 border-t border-[#E2DEEC]">
          <button
            type="button"
            onClick={handleSave}
            disabled={!title.trim() || updateActivity.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {updateActivity.isPending && (
              <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {updateActivity.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}
    </div>
  );
}
