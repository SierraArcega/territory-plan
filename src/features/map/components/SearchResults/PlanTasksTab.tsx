"use client";

import { useTasks } from "@/lib/api";
import type { TaskItem, TasksResponse } from "@/features/shared/types/api-types";

interface PlanTasksTabProps {
  planId: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  todo: { bg: "bg-[#f0edf5]", text: "text-[#6E6390]" },
  in_progress: { bg: "bg-[#e8f1f5]", text: "text-[#5A8FA8]" },
  done: { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" },
  blocked: { bg: "bg-[#FEF2F1]", text: "text-[#C4534A]" },
};

const PRIORITY_DOTS: Record<string, string> = {
  high: "bg-[#F37167]",
  medium: "bg-[#FFCF70]",
  low: "bg-[#C2BBD4]",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function isDueSoon(dateString: string | null): boolean {
  if (!dateString) return false;
  const due = new Date(dateString);
  const now = new Date();
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 3;
}

function isOverdue(dateString: string | null): boolean {
  if (!dateString) return false;
  return new Date(dateString) < new Date();
}

export default function PlanTasksTab({ planId }: PlanTasksTabProps) {
  const { data, isLoading } = useTasks({ planId });
  const response = data as TasksResponse | undefined;
  const tasks = response?.tasks ?? [];

  if (isLoading) {
    return (
      <div className="p-5 space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-[#f0edf5]">
            <div className="h-3 bg-[#f0edf5] rounded w-3/4 mb-2" />
            <div className="h-2.5 bg-[#f0edf5] rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No tasks yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Tasks linked to this plan will appear here.</p>
      </div>
    );
  }

  return (
    <div className="p-5 space-y-2">
      {tasks.map((task: TaskItem) => {
        const status = task.status ?? "todo";
        const priority = task.priority ?? "medium";
        const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.todo;
        const priorityDot = PRIORITY_DOTS[priority] ?? PRIORITY_DOTS.medium;
        const overdue = status !== "done" && isOverdue(task.dueDate);
        const dueSoon = !overdue && status !== "done" && isDueSoon(task.dueDate);

        return (
          <div
            key={task.id}
            className="p-3 rounded-lg border border-[#E2DEEC] hover:border-[#D4CFE2] hover:bg-[#FAFAFE] transition-colors"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className={`w-2 h-2 rounded-full shrink-0 ${priorityDot}`} />
                <span className="text-xs font-semibold text-[#544A78] truncate">{task.title}</span>
              </div>
              <span
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${statusColor.bg} ${statusColor.text}`}
              >
                {status.replace("_", " ")}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-[#8A80A8] pl-4">
              {task.dueDate && (
                <span
                  className={
                    overdue
                      ? "text-[#F37167] font-medium"
                      : dueSoon
                        ? "text-[#D4A843] font-medium"
                        : ""
                  }
                >
                  Due {formatDate(task.dueDate)}
                  {overdue && " (overdue)"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
