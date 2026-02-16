"use client";

import { useState, useEffect, useMemo } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import {
  useTerritoryPlans,
  useTerritoryPlan,
  useActivity,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
} from "@/lib/api";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  CATEGORY_LABELS,
  VALID_ACTIVITY_STATUSES,
} from "@/lib/activityTypes";
import type {
  ActivityType,
  ActivityStatus,
  ActivityCategory,
} from "@/lib/activityTypes";

interface ActivityFormProps {
  activityId?: string;
  preLinkedLeaid?: string;
}

export default function ActivityForm({
  activityId,
  preLinkedLeaid,
}: ActivityFormProps) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  const { data: allPlans } = useTerritoryPlans();
  const { data: planData } = useTerritoryPlan(activePlanId);
  const { data: existingActivity, isLoading: isLoadingActivity } = useActivity(
    activityId ?? null
  );

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const isEditing = !!activityId;

  // Form state
  const [type, setType] = useState<ActivityType | null>(null);
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("planned");
  const [notes, setNotes] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(
    new Set()
  );
  const [selectedLeaids, setSelectedLeaids] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-fill from existing activity when editing
  useEffect(() => {
    if (isEditing && existingActivity) {
      setType(existingActivity.type);
      setTitle(existingActivity.title);
      setStartDate(existingActivity.startDate ?? "");
      setEndDate(existingActivity.endDate ?? "");
      setStatus(existingActivity.status);
      setNotes(existingActivity.notes ?? "");
      setSelectedPlanIds(
        new Set(existingActivity.plans.map((p) => p.planId))
      );
      setSelectedLeaids(
        new Set(existingActivity.districts.map((d) => d.leaid))
      );
    }
  }, [isEditing, existingActivity]);

  // Pre-check active plan when creating
  useEffect(() => {
    if (!isEditing && activePlanId) {
      setSelectedPlanIds(new Set([activePlanId]));
    }
  }, [isEditing, activePlanId]);

  // Pre-check district when creating with preLinkedLeaid
  useEffect(() => {
    if (!isEditing && preLinkedLeaid) {
      setSelectedLeaids(new Set([preLinkedLeaid]));
    }
  }, [isEditing, preLinkedLeaid]);

  // Plan districts for checkboxes
  const planDistricts = useMemo(
    () => planData?.districts ?? [],
    [planData]
  );

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const toggleDistrict = (leaid: string) => {
    setSelectedLeaids((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) {
        next.delete(leaid);
      } else {
        next.add(leaid);
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!title.trim() || !type) return;

    try {
      if (isEditing && activityId) {
        await updateActivity.mutateAsync({
          activityId,
          type,
          title: title.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
          status,
          notes: notes.trim() || null,
        });
      } else {
        await createActivity.mutateAsync({
          type,
          title: title.trim(),
          startDate: startDate || null,
          endDate: endDate || null,
          status,
          notes: notes.trim() || null,
          planIds: Array.from(selectedPlanIds),
          districtLeaids: Array.from(selectedLeaids),
        });
      }
      closeRightPanel();
    } catch {
      // Error is handled by react-query
    }
  };

  const handleDelete = async () => {
    if (!activityId) return;
    try {
      await deleteActivity.mutateAsync(activityId);
      closeRightPanel();
    } catch {
      // Error is handled by react-query
    }
  };

  const isSaving = createActivity.isPending || updateActivity.isPending;
  const isDeleting = deleteActivity.isPending;

  if (isEditing && isLoadingActivity) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Type
        </label>
        <div className="space-y-2">
          {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map(
            (category) => (
              <div key={category}>
                <div className="text-[10px] font-medium text-gray-400 mb-1">
                  {CATEGORY_LABELS[category]}
                </div>
                <div className="flex flex-wrap gap-1">
                  {ACTIVITY_CATEGORIES[category].map((t) => {
                    const isSelected = type === t;
                    return (
                      <button
                        key={t}
                        onClick={() => setType(t)}
                        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all ${
                          isSelected
                            ? "bg-gray-800 text-white"
                            : "bg-gray-50 text-gray-500 hover:bg-gray-100"
                        }`}
                      >
                        {isSelected && (
                          <span className="text-[10px]">
                            {ACTIVITY_TYPE_ICONS[t]}
                          </span>
                        )}
                        {ACTIVITY_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Activity title"
          autoFocus
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300"
        />
      </div>

      {/* Start Date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Start Date
        </label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors"
        />
      </div>

      {/* End Date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          End Date
        </label>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors"
        />
      </div>

      {/* Status */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Status
        </label>
        <div className="flex gap-1">
          {VALID_ACTIVITY_STATUSES.map((s) => {
            const config = ACTIVITY_STATUS_CONFIG[s];
            const isSelected = status === s;
            return (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`flex-1 flex items-center justify-center px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  isSelected
                    ? "ring-1 ring-offset-1"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: config.bgColor,
                        color: config.color,
                        // @ts-expect-error -- CSS custom property for ring color
                        "--tw-ring-color": config.color,
                      }
                    : undefined
                }
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Plans */}
      {allPlans && allPlans.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Plans
          </label>
          <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100 p-1.5">
            {allPlans.map((plan) => {
              const isChecked = selectedPlanIds.has(plan.id);
              return (
                <label
                  key={plan.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => togglePlan(plan.id)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-gray-700 focus:ring-0 focus:ring-offset-0"
                  />
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: plan.color }}
                  />
                  <span className="text-xs text-gray-600 truncate">
                    {plan.name}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Districts */}
      {planDistricts.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Linked Districts
          </label>
          <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100 p-1.5">
            {planDistricts.map((d) => {
              const isChecked = selectedLeaids.has(d.leaid);
              return (
                <label
                  key={d.leaid}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleDistrict(d.leaid)}
                    className="w-3.5 h-3.5 rounded border-gray-300 text-gray-700 focus:ring-0 focus:ring-offset-0"
                  />
                  <span className="text-xs text-gray-600 truncate">
                    {d.name}
                  </span>
                  {d.stateAbbrev && (
                    <span className="text-[9px] text-gray-400 shrink-0">
                      {d.stateAbbrev}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Add notes..."
          rows={2}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300 resize-none"
        />
      </div>

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!title.trim() || !type || isSaving}
          className="w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Activity"
              : "Create Activity"}
        </button>

        {/* Delete button (edit mode only) */}
        {isEditing && !showDeleteConfirm && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Activity
          </button>
        )}

        {/* Delete confirmation */}
        {isEditing && showDeleteConfirm && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-xs text-red-600 font-medium">
              Delete this activity permanently?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Type skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-10 mb-1.5 animate-pulse" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <div className="h-2 bg-gray-100 rounded w-16 mb-1 animate-pulse" />
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: i === 1 ? 3 : 4 }).map((_, j) => (
                  <div
                    key={j}
                    className="h-7 w-20 bg-gray-100 rounded-lg animate-pulse"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Title skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-12 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Date skeletons */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-18 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-gray-200 rounded w-16 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Status skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-14 mb-1.5 animate-pulse" />
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex-1 h-8 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
      {/* Button skeleton */}
      <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
