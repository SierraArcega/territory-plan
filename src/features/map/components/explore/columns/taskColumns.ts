// Column definitions for the Tasks entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/tasks.

import type { ColumnDef } from "@/features/shared/components/DataGrid/types";

export interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  createdAt: string;
  districtNames: string[];
  planNames: string[];
  contactNames: string[];
  activityNames: string[];
}

export const taskColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "title",
    label: "Title",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "status",
    label: "Status",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["todo", "in_progress", "blocked", "done"],
  },
  {
    key: "priority",
    label: "Priority",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["low", "medium", "high", "urgent"],
  },
  {
    key: "description",
    label: "Description",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },

  // ---- Scheduling ----
  {
    key: "dueDate",
    label: "Due Date",
    group: "Scheduling",
    isDefault: true,
    filterType: "date",
  },
  {
    key: "createdAt",
    label: "Created",
    group: "Scheduling",
    isDefault: false,
    filterType: "date",
  },

  // ---- Associations ----
  {
    key: "districtNames",
    label: "Districts",
    group: "Associations",
    isDefault: true,
    filterType: "text",
    sortable: false,
  },
  {
    key: "planNames",
    label: "Plans",
    group: "Associations",
    isDefault: true,
    filterType: "text",
    sortable: false,
  },
  {
    key: "contactNames",
    label: "Contacts",
    group: "Associations",
    isDefault: false,
    filterType: "text",
    sortable: false,
  },
  {
    key: "activityNames",
    label: "Activities",
    group: "Associations",
    isDefault: false,
    filterType: "text",
    sortable: false,
  },
];
