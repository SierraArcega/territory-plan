"use client";

import { useState, useMemo } from "react";
import { useTasks, type TaskItem } from "@/lib/api";
import {
  TASK_STATUSES,
  TASK_STATUS_CONFIG,
  TASK_PRIORITIES,
  TASK_PRIORITY_CONFIG,
  type TaskStatus,
  type TaskPriority,
} from "@/features/tasks/types";
import KanbanBoard from "@/features/tasks/components/KanbanBoard";
import TasksTable from "@/features/tasks/components/TasksTable";
import TaskDetailModal from "@/features/tasks/components/TaskDetailModal";
import TaskFormModal from "@/features/tasks/components/TaskFormModal";

type ViewMode = "board" | "list";
type StatusFilter = "all" | TaskStatus;
type PriorityFilter = "all" | TaskPriority;

const selectStyle =
  "h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";

export default function TasksView() {
  const [view, setView] = useState<ViewMode>("board");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  // Build query params — only send status/priority to the API when filtering
  const queryParams = useMemo(() => ({
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
  }), [statusFilter, priorityFilter]);

  const { data, isLoading, error } = useTasks(queryParams);

  // Client-side search filtering (title search is fast enough client-side)
  const filteredTasks = useMemo(() => {
    if (!data?.tasks || !searchQuery.trim()) return data?.tasks || [];
    const query = searchQuery.toLowerCase().trim();
    return data.tasks.filter((t) => t.title.toLowerCase().includes(query));
  }, [data?.tasks, searchQuery]);

  const hasActiveFilters =
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    searchQuery.trim().length > 0;

  const handleTaskClick = (task: TaskItem) => {
    setSelectedTask(task);
  };

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className={view === "board" ? "" : "max-w-6xl mx-auto"}>
          <h1 className="text-xl font-bold text-[#403770]">Tasks</h1>
          <p className="text-sm text-gray-500">
            Track your to-do items across territory plans, activities, and districts
          </p>
        </div>
      </header>

      {/* Toolbar */}
      <div className={`bg-white border-b border-gray-200 px-6 py-3 ${view === "list" ? "" : ""}`}>
        <div className={`flex items-center flex-wrap gap-2 ${view === "list" ? "max-w-6xl mx-auto" : ""}`}>
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={selectStyle}
          >
            <option value="all">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>{TASK_STATUS_CONFIG[s].label}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as PriorityFilter)}
            className={selectStyle}
          >
            <option value="all">All Priorities</option>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>{TASK_PRIORITY_CONFIG[p].icon} {TASK_PRIORITY_CONFIG[p].label}</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-8 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] placeholder:text-gray-400 w-52"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* View toggle */}
          <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
            <button
              onClick={() => setView("board")}
              className={`h-9 px-3 text-sm font-medium transition-colors ${
                view === "board"
                  ? "bg-[#403770] text-white"
                  : "bg-white text-gray-500 hover:text-[#403770]"
              }`}
              title="Board view"
            >
              {/* Kanban icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
              </svg>
            </button>
            <button
              onClick={() => setView("list")}
              className={`h-9 px-3 text-sm font-medium transition-colors ${
                view === "list"
                  ? "bg-[#403770] text-white"
                  : "bg-white text-gray-500 hover:text-[#403770]"
              }`}
              title="List view"
            >
              {/* List icon */}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
          </div>

          {/* New Task button */}
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 h-9 px-4 text-sm font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Task
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
            <p className="text-[#403770] font-medium">Loading tasks...</p>
          </div>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-red-500">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium mb-1">Error loading tasks</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </div>
      ) : filteredTasks.length > 0 || view === "board" ? (
        <main className={`${view === "board" ? "px-6 py-6" : "max-w-6xl mx-auto px-6 py-6"}`}>
          {view === "board" ? (
            <KanbanBoard tasks={filteredTasks} onTaskClick={handleTaskClick} />
          ) : (
            <TasksTable tasks={filteredTasks} onTaskClick={handleTaskClick} />
          )}
        </main>
      ) : (
        <div className="text-center py-20">
          {hasActiveFilters ? (
            <>
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h2 className="text-lg font-semibold text-gray-600 mb-2">
                No tasks match your filters
              </h2>
              <p className="text-gray-500 text-sm">
                Try adjusting your filters or search query.
              </p>
            </>
          ) : (
            <>
              <svg className="w-20 h-20 mx-auto text-gray-300 mb-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7l2 2 4-4M14 7h6M4 17l2 2 4-4M14 17h6" />
              </svg>
              <h2 className="text-xl font-semibold text-gray-600 mb-2">
                No tasks yet
              </h2>
              <p className="text-gray-500 max-w-md mx-auto mb-6">
                Create your first task to start tracking to-do items alongside your territory plans and activities.
              </p>
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create Your First Task
              </button>
            </>
          )}
        </div>
      )}

      {/* Create Task Modal */}
      <TaskFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
      />

      {/* Task Detail Modal */}
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
