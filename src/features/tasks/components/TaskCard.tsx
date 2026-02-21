"use client";

import { TASK_PRIORITY_CONFIG, type TaskPriority } from "@/features/tasks/types";
import type { TaskItem } from "@/lib/api";

// Compact card used in the kanban board columns
// Draggable, shows title, priority, due date, and linked entity chips
interface TaskCardProps {
  task: TaskItem;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}

export default function TaskCard({ task, onClick, onDragStart }: TaskCardProps) {
  const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority];
  const isOverdue = task.dueDate && new Date(task.dueDate.split("T")[0] + "T00:00:00") < new Date() && task.status !== "done";

  // Collect all linked entities to show as chips
  const chips: { label: string; color: string }[] = [];
  for (const p of task.plans) {
    chips.push({ label: p.planName, color: p.planColor });
  }
  for (const d of task.districts) {
    chips.push({ label: d.name, color: "#6EA3BE" });
  }
  for (const a of task.activities) {
    chips.push({ label: a.title, color: "#F37167" });
  }
  for (const c of task.contacts) {
    chips.push({ label: c.name, color: "#8AA891" });
  }

  // Show max 2 chips, then "+N more"
  const visibleChips = chips.slice(0, 2);
  const extraCount = chips.length - visibleChips.length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:shadow-md transition-shadow select-none"
    >
      {/* Title */}
      <p className="text-sm font-medium text-[#403770] mb-1.5 line-clamp-2">
        {task.title}
      </p>

      {/* Priority badge + due date row */}
      <div className="flex items-center gap-2 text-xs">
        {/* Priority indicator */}
        <span
          className="inline-flex items-center gap-0.5 font-medium"
          style={{ color: priorityConfig.color }}
        >
          <span>{priorityConfig.icon}</span>
          {priorityConfig.label}
        </span>

        {/* Due date */}
        {task.dueDate && (
          <span className={`${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
            {isOverdue ? "Overdue: " : ""}
            {new Date(task.dueDate.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        )}
      </div>

      {/* Linked entity chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {visibleChips.map((chip, i) => (
            <span
              key={i}
              className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full text-white truncate max-w-[100px]"
              style={{ backgroundColor: chip.color }}
              title={chip.label}
            >
              {chip.label}
            </span>
          ))}
          {extraCount > 0 && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-500">
              +{extraCount} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
