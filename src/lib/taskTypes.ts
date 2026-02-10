// Task status and priority definitions
// Follows the same pattern as activityTypes.ts

export const TASK_STATUSES = ["todo", "in_progress", "blocked", "done"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

// Display config for each status — used in kanban column headers, badges, and filters
export const TASK_STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string }
> = {
  todo:        { label: "To Do",       color: "#6EA3BE", bgColor: "#EEF5F8" },
  in_progress: { label: "In Progress", color: "#F37167", bgColor: "#FEF2F1" },
  blocked:     { label: "Blocked",     color: "#9CA3AF", bgColor: "#F3F4F6" },
  done:        { label: "Done",        color: "#8AA891", bgColor: "#EFF5F0" },
};

// Display config for each priority — used in badges and dropdowns
export const TASK_PRIORITY_CONFIG: Record<
  TaskPriority,
  { label: string; color: string; icon: string }
> = {
  low:    { label: "Low",    color: "#6EA3BE", icon: "\u2193" },
  medium: { label: "Medium", color: "#F59E0B", icon: "\u2192" },
  high:   { label: "High",   color: "#F37167", icon: "\u2191" },
  urgent: { label: "Urgent", color: "#DC2626", icon: "\u26A1" },
};
