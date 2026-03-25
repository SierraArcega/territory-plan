"use client";

import { useMemo, useCallback } from "react";
import { X } from "lucide-react";
import { useUsers } from "@/features/shared/lib/queries";

export interface TaskRow {
  title: string;
  assignedToUserId: string;
  priority: "high" | "medium" | "low";
  dueDate: string;
}

interface TaskRowListProps {
  tasks: TaskRow[];
  onChange: (tasks: TaskRow[]) => void;
  currentUserId: string;
}

const PRIORITIES: { value: TaskRow["priority"]; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Med" },
  { value: "high", label: "High" },
];

const inputStyle =
  "w-full px-3 py-2 text-sm font-medium border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white text-[#403770] placeholder:text-[#A69DC0]";

const labelStyle =
  "block text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1.5";

export default function TaskRowList({ tasks, onChange, currentUserId }: TaskRowListProps) {
  const { data: users } = useUsers();

  const userOptions = useMemo(
    () => (users ?? []).map((u) => ({ value: u.id, label: u.fullName || u.email })),
    [users]
  );

  const updateTask = useCallback(
    (index: number, field: keyof TaskRow, value: string) => {
      onChange(tasks.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
    },
    [tasks, onChange]
  );

  const removeTask = useCallback(
    (index: number) => {
      onChange(tasks.filter((_, i) => i !== index));
    },
    [tasks, onChange]
  );

  const addTask = useCallback(() => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    onChange([
      ...tasks,
      {
        title: "",
        assignedToUserId: currentUserId,
        priority: "medium",
        dueDate: dueDate.toISOString().split("T")[0],
      },
    ]);
  }, [tasks, onChange, currentUserId]);

  return (
    <div>
      <p className={labelStyle}>Follow-up Tasks</p>
      <div className="space-y-2">
        {tasks.map((task, i) => (
          <div
            key={i}
            className="border border-[#E2DEEC] rounded-lg p-3 space-y-2"
          >
            {/* Title row */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={task.title}
                onChange={(e) => updateTask(i, "title", e.target.value)}
                placeholder="Task title..."
                className={`flex-1 ${inputStyle}`}
              />
              {tasks.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTask(i)}
                  className="p-1 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors cursor-pointer"
                  title="Remove task"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Details row: assignee, priority chips, date */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Assignee dropdown */}
              <select
                value={task.assignedToUserId}
                onChange={(e) => updateTask(i, "assignedToUserId", e.target.value)}
                className="flex-1 min-w-[120px] px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-xs text-[#403770] focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white"
              >
                <option value="">Assign to...</option>
                {userOptions.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>

              {/* Priority chips */}
              <div className="flex gap-1">
                {PRIORITIES.map((p) => {
                  const isSelected = task.priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateTask(i, "priority", p.value)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer ${
                        isSelected
                          ? "bg-[#403770] text-white"
                          : "bg-[#F7F5FA] text-[#6E6390] hover:bg-[#EFEDF5]"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>

              {/* Due date */}
              <input
                type="date"
                value={task.dueDate}
                onChange={(e) => updateTask(i, "dueDate", e.target.value)}
                className="px-2 py-1.5 border border-[#C2BBD4] rounded-lg text-xs text-[#403770] focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white"
              />
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addTask}
        className="mt-2 text-sm text-[#6E6390] hover:text-[#403770] font-medium transition-colors cursor-pointer"
      >
        + Add another task
      </button>
    </div>
  );
}
