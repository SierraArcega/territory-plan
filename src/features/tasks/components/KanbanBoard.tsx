"use client";

import { useState, useCallback } from "react";
import { TASK_STATUSES, TASK_STATUS_CONFIG, type TaskStatus } from "@/features/tasks/types";
import { useReorderTasks, type TaskItem } from "@/lib/api";
import TaskCard from "./TaskCard";
import QuickAddTask from "./QuickAddTask";

// Kanban board with 4 columns (To Do, In Progress, Blocked, Done)
// Uses HTML5 drag-and-drop — no external library needed
interface KanbanBoardProps {
  tasks: TaskItem[];
  onTaskClick: (task: TaskItem) => void;
}

export default function KanbanBoard({ tasks, onTaskClick }: KanbanBoardProps) {
  const reorderTasks = useReorderTasks();
  // Track which column is being dragged over for visual feedback
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  // Track the task currently being dragged
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  // Group tasks by status column
  const columns: Record<TaskStatus, TaskItem[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
  };

  for (const task of tasks) {
    const status = task.status as TaskStatus;
    if (columns[status]) {
      columns[status].push(task);
    }
  }

  // Sort each column by position
  for (const status of TASK_STATUSES) {
    columns[status].sort((a, b) => a.position - b.position);
  }

  // Handle drag start — store the task ID in the drag data
  const handleDragStart = useCallback((e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
    setDraggedTaskId(taskId);
  }, []);

  // Handle drag over — allow drop and show visual indicator
  const handleDragOver = useCallback((e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  // Handle drop — move task to new column and update positions
  const handleDrop = useCallback((e: React.DragEvent, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    setDraggedTaskId(null);

    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    // Find the dragged task
    const draggedTask = tasks.find((t) => t.id === taskId);
    if (!draggedTask) return;

    // Skip if dropped in the same column
    if (draggedTask.status === targetStatus) return;

    // Build the new column with the task appended at the end
    const targetTasks = columns[targetStatus];
    const newPosition = targetTasks.length > 0
      ? Math.max(...targetTasks.map((t) => t.position)) + 1
      : 0;

    // Send only the moved task's update — keeps it simple
    reorderTasks.mutate([
      { taskId, status: targetStatus, position: newPosition },
    ]);
  }, [tasks, columns, reorderTasks]);

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-200px)]">
      {TASK_STATUSES.map((status) => {
        const config = TASK_STATUS_CONFIG[status];
        const columnTasks = columns[status];
        const isDragOver = dragOverColumn === status;

        return (
          <div
            key={status}
            className="flex-shrink-0 w-72 flex flex-col"
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
          >
            {/* Column header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-t-lg mb-2"
              style={{ backgroundColor: config.bgColor }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: config.color }}
              />
              <span className="text-sm font-semibold" style={{ color: config.color }}>
                {config.label}
              </span>
              <span className="ml-auto text-xs font-medium text-gray-400">
                {columnTasks.length}
              </span>
            </div>

            {/* Scrollable card list */}
            <div
              className={`flex-1 space-y-2 p-1 rounded-lg transition-colors ${
                isDragOver ? "bg-gray-100 ring-2 ring-dashed ring-gray-300" : ""
              }`}
            >
              {columnTasks.map((task) => (
                <div
                  key={task.id}
                  className={draggedTaskId === task.id ? "opacity-40" : ""}
                >
                  <TaskCard
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onDragStart={(e) => handleDragStart(e, task.id)}
                  />
                </div>
              ))}

              {/* Quick add at the bottom of each column */}
              <QuickAddTask status={status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
