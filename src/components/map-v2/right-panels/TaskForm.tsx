"use client";

import { useState, useEffect, useMemo } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import {
  useTerritoryPlan,
  useTask,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
} from "@/lib/api";
import { TASK_PRIORITIES, TASK_PRIORITY_CONFIG } from "@/lib/taskTypes";
import type { TaskPriority } from "@/lib/taskTypes";

interface TaskFormProps {
  taskId?: string;
  preLinkedLeaid?: string;
}

export default function TaskForm({ taskId, preLinkedLeaid }: TaskFormProps) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  const { data: planData } = useTerritoryPlan(activePlanId);
  const { data: existingTask, isLoading: isLoadingTask } = useTask(
    taskId ?? null
  );

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const isEditing = !!taskId;

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [linkedLeaids, setLinkedLeaids] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-fill from existing task when editing
  useEffect(() => {
    if (isEditing && existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description ?? "");
      setPriority(existingTask.priority);
      setDueDate(existingTask.dueDate ?? "");
      setLinkedLeaids(
        new Set(existingTask.districts.map((d) => d.leaid))
      );
    }
  }, [isEditing, existingTask]);

  // Pre-check district when creating with preLinkedLeaid
  useEffect(() => {
    if (!isEditing && preLinkedLeaid) {
      setLinkedLeaids(new Set([preLinkedLeaid]));
    }
  }, [isEditing, preLinkedLeaid]);

  // Plan districts for checkboxes
  const planDistricts = useMemo(
    () => planData?.districts ?? [],
    [planData]
  );

  const toggleDistrict = (leaid: string) => {
    setLinkedLeaids((prev) => {
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
    if (!title.trim()) return;

    try {
      if (isEditing && taskId) {
        await updateTask.mutateAsync({
          taskId,
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueDate: dueDate || null,
        });
      } else {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description.trim() || null,
          priority,
          dueDate: dueDate || null,
          status: "todo",
          planIds: activePlanId ? [activePlanId] : [],
          leaids: Array.from(linkedLeaids),
        });
      }
      closeRightPanel();
    } catch {
      // Error is handled by react-query
    }
  };

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await deleteTask.mutateAsync(taskId);
      closeRightPanel();
    } catch {
      // Error is handled by react-query
    }
  };

  const isSaving = createTask.isPending || updateTask.isPending;
  const isDeleting = deleteTask.isPending;

  if (isEditing && isLoadingTask) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          autoFocus
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Add details..."
          rows={2}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300 resize-none"
        />
      </div>

      {/* Priority */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Priority
        </label>
        <div className="flex gap-1">
          {TASK_PRIORITIES.map((p) => {
            const config = TASK_PRIORITY_CONFIG[p];
            const isSelected = priority === p;
            return (
              <button
                key={p}
                onClick={() => setPriority(p)}
                className={`flex-1 flex items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  isSelected
                    ? "ring-1 ring-offset-1"
                    : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                }`}
                style={
                  isSelected
                    ? {
                        backgroundColor: `${config.color}18`,
                        color: config.color,
                        // @ts-expect-error -- CSS custom property for ring color
                        "--tw-ring-color": config.color,
                      }
                    : undefined
                }
              >
                <span className="text-[9px]">{config.icon}</span>
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Due date */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Due Date
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors"
        />
      </div>

      {/* Districts */}
      {planDistricts.length > 0 && (
        <div>
          <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
            Linked Districts
          </label>
          <div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100 p-1.5">
            {planDistricts.map((d) => {
              const isChecked = linkedLeaids.has(d.leaid);
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

      {/* Actions */}
      <div className="space-y-2 pt-1">
        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={!title.trim() || isSaving}
          className="w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving
            ? "Saving..."
            : isEditing
              ? "Update Task"
              : "Create Task"}
        </button>

        {/* Delete button (edit mode only) */}
        {isEditing && !showDeleteConfirm && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Task
          </button>
        )}

        {/* Delete confirmation */}
        {isEditing && showDeleteConfirm && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-xs text-red-600 font-medium">
              Delete this task permanently?
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
      {/* Title skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-12 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Description skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-20 mb-1.5 animate-pulse" />
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Priority skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-14 mb-1.5 animate-pulse" />
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex-1 h-8 bg-gray-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
      {/* Due date skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-16 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Button skeleton */}
      <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
