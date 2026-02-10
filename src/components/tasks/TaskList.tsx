"use client";

import { useState } from "react";
import { useTasks, useUpdateTask, type TaskItem, type TasksParams } from "@/lib/api";
import { TASK_PRIORITY_CONFIG, type TaskPriority } from "@/lib/taskTypes";
import QuickAddTask from "./QuickAddTask";
import TaskDetailModal from "./TaskDetailModal";

// Compact reusable task list — embedded in activity detail, plan tabs, district panel
// Each row: checkbox (toggle done/todo), title, priority dot, due date badge
interface TaskListProps {
  // Filter context — pass one or more to scope the task list
  planId?: string;
  activityId?: string;
  leaid?: string;
  contactId?: string;
  compact?: boolean; // tighter spacing for side panel
}

export default function TaskList({
  planId,
  activityId,
  leaid,
  contactId,
  compact = false,
}: TaskListProps) {
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Build filter params from the context props
  const params: TasksParams = {};
  if (planId) params.planId = planId;
  if (activityId) params.activityId = activityId;
  if (leaid) params.leaid = leaid;
  if (contactId) params.contactId = contactId;

  const { data, isLoading } = useTasks(params);
  const updateTask = useUpdateTask();
  const tasks = data?.tasks || [];

  // Toggle task between done and todo
  const handleToggle = (task: TaskItem) => {
    const newStatus = task.status === "done" ? "todo" : "done";
    updateTask.mutate({ taskId: task.id, status: newStatus });
  };

  if (isLoading) {
    return (
      <div className="py-3 text-center">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#F37167] border-t-transparent mx-auto" />
      </div>
    );
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-1.5"}>
      {/* Task rows */}
      {tasks.map((task) => {
        const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority];
        const isDone = task.status === "done";
        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !isDone;

        return (
          <div
            key={task.id}
            className={`flex items-center gap-2 px-2 ${compact ? "py-1" : "py-1.5"} rounded-md hover:bg-gray-50 group cursor-pointer`}
            onClick={() => setSelectedTask(task)}
          >
            {/* Checkbox — toggles done/todo */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleToggle(task);
              }}
              className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                isDone
                  ? "bg-[#8AA891] border-[#8AA891] text-white"
                  : "border-gray-300 hover:border-[#403770]"
              }`}
            >
              {isDone && (
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>

            {/* Title */}
            <span
              className={`flex-1 text-sm truncate ${
                isDone ? "text-gray-400 line-through" : "text-[#403770]"
              }`}
            >
              {task.title}
            </span>

            {/* Priority dot */}
            <span
              className="flex-shrink-0 w-2 h-2 rounded-full"
              style={{ backgroundColor: priorityConfig.color }}
              title={priorityConfig.label}
            />

            {/* Due date badge */}
            {task.dueDate && (
              <span
                className={`flex-shrink-0 text-[10px] font-medium ${
                  isOverdue ? "text-red-500" : "text-gray-400"
                }`}
              >
                {new Date(task.dueDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            )}
          </div>
        );
      })}

      {/* Empty state */}
      {tasks.length === 0 && (
        <p className="text-xs text-gray-400 px-2 py-1">No tasks yet</p>
      )}

      {/* Quick add — pre-links to the context entity */}
      <QuickAddTask
        planId={planId}
        activityId={activityId}
        leaid={leaid}
        contactId={contactId ? parseInt(contactId) : undefined}
        placeholder="Add a task..."
      />

      {/* Detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
