"use client";

import { useState } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useTasks, useUpdateTask } from "@/lib/api";
import type { TaskStatus } from "@/lib/taskTypes";
import { TASK_PRIORITY_CONFIG } from "@/lib/taskTypes";
import type { TaskItem } from "@/lib/api";

// Filter chip options
const FILTER_OPTIONS: { label: string; value: TaskStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "To Do", value: "todo" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done", value: "done" },
];

function formatDueDate(dateStr: string): { text: string; isOverdue: boolean } {
  const due = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { text: "Today", isOverdue: false };
  if (diffDays === 1) return { text: "Tomorrow", isOverdue: false };
  if (diffDays === -1) return { text: "Yesterday", isOverdue: true };

  const isOverdue = diffDays < 0;
  const formatted = due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return { text: formatted, isOverdue };
}

export default function PlanTasksSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const [statusFilter, setStatusFilter] = useState<TaskStatus | undefined>(
    undefined
  );

  const { data, isLoading } = useTasks({
    planId: activePlanId || undefined,
    status: statusFilter,
  });

  const updateTask = useUpdateTask();

  const tasks = data?.tasks ?? [];

  return (
    <div className="p-3 space-y-3">
      {/* Filter chips */}
      <div className="flex gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = statusFilter === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && <LoadingSkeleton />}

      {/* Task list */}
      {!isLoading && tasks.length > 0 && (
        <div className="space-y-1">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={(taskId, currentStatus) => {
                const newStatus: TaskStatus =
                  currentStatus === "done" ? "todo" : "done";
                updateTask.mutate({ taskId, status: newStatus });
              }}
              onClick={(taskId) =>
                openRightPanel({ type: "task_edit", id: taskId })
              }
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && tasks.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-300 mb-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="mx-auto"
            >
              <rect
                x="6"
                y="4"
                width="20"
                height="24"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M11 12H21M11 17H21M11 22H17"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-400 font-medium">No tasks yet</p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Create a task to start tracking work
          </p>
        </div>
      )}

      {/* New task button */}
      <button
        onClick={() => openRightPanel({ type: "task_form" })}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-medium text-gray-400 hover:border-gray-300 hover:text-gray-500 hover:bg-gray-50/50 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 2V10M2 6H10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        New Task
      </button>
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onClick,
}: {
  task: TaskItem;
  onToggle: (taskId: string, currentStatus: TaskStatus) => void;
  onClick: (taskId: string) => void;
}) {
  const isDone = task.status === "done";
  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority];
  const districtCount = task.districts?.length ?? 0;

  return (
    <div
      onClick={() => onClick(task.id)}
      className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggle(task.id, task.status);
        }}
        className={`w-4 h-4 rounded border-[1.5px] flex items-center justify-center shrink-0 transition-colors ${
          isDone
            ? "bg-emerald-500 border-emerald-500"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        {isDone && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
            <path
              d="M1.5 4L3.5 6L6.5 2"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Title */}
      <span
        className={`flex-1 text-xs truncate ${
          isDone
            ? "line-through text-gray-400"
            : "text-gray-700 font-medium"
        }`}
        title={task.title}
      >
        {task.title}
      </span>

      {/* Priority pill */}
      <span
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0"
        style={{
          backgroundColor: `${priorityConfig.color}18`,
          color: priorityConfig.color,
        }}
      >
        <span className="text-[8px]">{priorityConfig.icon}</span>
        {priorityConfig.label}
      </span>

      {/* Due date */}
      {task.dueDate && (
        <DueDateBadge dueDate={task.dueDate} isDone={isDone} />
      )}

      {/* District count */}
      {districtCount > 0 && (
        <span className="text-[9px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">
          {districtCount}d
        </span>
      )}
    </div>
  );
}

function DueDateBadge({
  dueDate,
  isDone,
}: {
  dueDate: string;
  isDone: boolean;
}) {
  const { text, isOverdue } = formatDueDate(dueDate);
  const showOverdue = isOverdue && !isDone;

  return (
    <span
      className={`text-[9px] font-medium shrink-0 ${
        showOverdue ? "text-red-500" : "text-gray-400"
      }`}
    >
      {text}
    </span>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
        >
          <div className="w-4 h-4 rounded border border-gray-200 animate-pulse bg-gray-100" />
          <div className="flex-1 h-3 bg-gray-100 rounded animate-pulse" />
          <div className="w-12 h-4 bg-gray-100 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
}
