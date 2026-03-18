"use client";

import { useMemo } from "react";
import { useUsers } from "@/features/shared/lib/queries";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_CONFIG,
  type TaskPriority,
} from "@/features/tasks/types";

export interface TaskDraft {
  title: string;
  priority: TaskPriority;
  dueDate: string;
  assigneeUserId: string;
}

interface TaskLineItemsProps {
  tasks: TaskDraft[];
  onChange: (tasks: TaskDraft[]) => void;
}

export default function TaskLineItems({ tasks, onChange }: TaskLineItemsProps) {
  const { data: users } = useUsers();

  const userOptions = useMemo(
    () => (users ?? []).map((u) => ({ value: u.id, label: u.fullName || u.email })),
    [users]
  );

  const addTask = () => {
    onChange([...tasks, { title: "", priority: "medium", dueDate: "", assigneeUserId: "" }]);
  };

  const removeTask = (index: number) => {
    onChange(tasks.filter((_, i) => i !== index));
  };

  const updateTask = (index: number, field: keyof TaskDraft, value: string) => {
    onChange(tasks.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
  };

  return (
    <div>
      <label className="block text-xs font-medium text-[#8A80A8] mb-1">
        Tasks
      </label>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="border border-[#E2DEEC] rounded-lg p-3 space-y-2 bg-[#FDFCFF]"
          >
            {/* Title row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={task.title}
                onChange={(e) => updateTask(i, "title", e.target.value)}
                placeholder="Task title..."
                className="flex-1 px-3 py-1.5 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />
              <button
                type="button"
                onClick={() => removeTask(i)}
                className="p-1 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors"
                title="Remove task"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Details row: priority, due date, assignee */}
            <div className="flex items-center gap-2">
              {/* Priority chips */}
              <div className="flex gap-0.5">
                {TASK_PRIORITIES.map((p) => {
                  const config = TASK_PRIORITY_CONFIG[p];
                  const isSelected = task.priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => updateTask(i, "priority", p)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${
                        isSelected
                          ? "ring-1 ring-offset-1"
                          : "bg-[#F7F5FA] text-[#A69DC0] hover:text-[#403770]"
                      }`}
                      style={
                        isSelected
                          ? {
                              backgroundColor: `${config.color}18`,
                              color: config.color,
                              // @ts-expect-error -- CSS custom property
                              "--tw-ring-color": config.color,
                            }
                          : undefined
                      }
                      title={config.label}
                    >
                      {config.icon} {config.label}
                    </button>
                  );
                })}
              </div>

              {/* Due date */}
              <input
                type="date"
                value={task.dueDate}
                onChange={(e) => updateTask(i, "dueDate", e.target.value)}
                className="px-2 py-1 border border-[#C2BBD4] rounded-lg text-xs text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />

              {/* Assignee */}
              <select
                value={task.assigneeUserId}
                onChange={(e) => updateTask(i, "assigneeUserId", e.target.value)}
                className="flex-1 px-2 py-1 border border-[#C2BBD4] rounded-lg text-xs text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white"
              >
                <option value="">Assign to...</option>
                {userOptions.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addTask}
        className="mt-2 text-xs text-[#403770] hover:text-[#322a5a] font-medium"
      >
        + Add task
      </button>
    </div>
  );
}
