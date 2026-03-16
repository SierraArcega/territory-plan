"use client";

import { TASK_STATUS_CONFIG, TASK_PRIORITY_CONFIG, type TaskStatus, type TaskPriority } from "@/features/tasks/types";
import { useUpdateTask, type TaskItem } from "@/lib/api";
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";

// Table/list view for tasks — sortable columns with inline status and priority dropdowns
interface TasksTableProps {
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
}

// Workflow order maps — used by custom comparators so status/priority sort logically,
// not alphabetically (e.g. "todo" before "in_progress" before "done")
const STATUS_ORDER: Record<string, number> = { todo: 0, in_progress: 1, blocked: 2, done: 3 };
const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

// Module-level constant so the reference is stable across renders (avoids useMemo churn)
// Note: 'title' is not listed below because it's a non-nullable string field.
// The useSortableTable hook's defaultCompare fallback handles it via localeCompare.
const taskComparators: Record<string, SortComparator<TaskItem>> = {
  status: (a, b, dir) => {
    const r = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
  priority: (a, b, dir) => {
    const r = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    return dir === "desc" ? -r : r;
  },
  dueDate: (a, b, dir) => {
    // Null due dates always sort last (matches previous Infinity sentinel behavior)
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    const r = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    return dir === "desc" ? -r : r;
  },
  createdAt: (a, b, dir) => {
    // createdAt is typed as string (non-nullable), so no null check needed
    const r = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return dir === "desc" ? -r : r;
  },
};

export default function TasksTable({ tasks, onTaskClick }: TasksTableProps) {
  const { sorted: sortedTasks, sortState, onSort } = useSortableTable({
    data: tasks,
    defaultField: "createdAt",
    defaultDir: "desc",
    comparators: taskComparators,
  });

  const updateTask = useUpdateTask();

  // Inline status change
  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ taskId, status: newStatus as TaskStatus });
  };

  // Inline priority change
  const handlePriorityChange = (taskId: string, newPriority: string) => {
    updateTask.mutate({ taskId, priority: newPriority as TaskPriority });
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <SortHeader field="title" label="Title" sortState={sortState} onSort={onSort} className="w-[35%]" />
            <SortHeader field="status" label="Status" sortState={sortState} onSort={onSort} />
            <SortHeader field="priority" label="Priority" sortState={sortState} onSort={onSort} />
            <SortHeader field="dueDate" label="Due Date" sortState={sortState} onSort={onSort} />
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Linked
            </th>
            <SortHeader field="createdAt" label="Created" sortState={sortState} onSort={onSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sortedTasks.map((task) => {
            const statusConfig = TASK_STATUS_CONFIG[task.status as TaskStatus];
            const priorityConfig = TASK_PRIORITY_CONFIG[task.priority as TaskPriority];
            const isOverdue = task.dueDate && new Date(task.dueDate.split("T")[0] + "T00:00:00") < new Date() && task.status !== "done";
            const linkedCount = task.plans.length + task.districts.length + task.activities.length + task.contacts.length;

            return (
              <tr
                key={task.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => onTaskClick(task)}
              >
                {/* Title */}
                <td className="px-4 py-3">
                  <span className="text-sm font-medium text-[#403770]">{task.title}</span>
                </td>

                {/* Status dropdown */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusChange(task.id, e.target.value)}
                    className="text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer"
                    style={{ backgroundColor: statusConfig.bgColor, color: statusConfig.color }}
                  >
                    {Object.entries(TASK_STATUS_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>{cfg.label}</option>
                    ))}
                  </select>
                </td>

                {/* Priority dropdown */}
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <select
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(task.id, e.target.value)}
                    className="text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer bg-transparent"
                    style={{ color: priorityConfig.color }}
                  >
                    {Object.entries(TASK_PRIORITY_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>{cfg.icon} {cfg.label}</option>
                    ))}
                  </select>
                </td>

                {/* Due date */}
                <td className="px-4 py-3">
                  {task.dueDate ? (
                    <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-500"}`}>
                      {new Date(task.dueDate.split("T")[0] + "T00:00:00").toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">--</span>
                  )}
                </td>

                {/* Linked entities count */}
                <td className="px-4 py-3">
                  {linkedCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                      {linkedCount} linked
                    </span>
                  ) : (
                    <span className="text-xs text-gray-300">--</span>
                  )}
                </td>

                {/* Created date */}
                <td className="px-4 py-3">
                  <span className="text-xs text-gray-400">
                    {new Date(task.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
