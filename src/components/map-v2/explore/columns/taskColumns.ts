// Column definitions for the Tasks entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/tasks.

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags";
  enumValues?: string[];
}

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  districtNames: string[];
  planNames: string[];
  contactNames: string[];
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

  // ---- Scheduling ----
  {
    key: "dueDate",
    label: "Due Date",
    group: "Scheduling",
    isDefault: true,
    filterType: "date",
  },

  // ---- Associations ----
  {
    key: "districtNames",
    label: "Districts",
    group: "Associations",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "planNames",
    label: "Plans",
    group: "Associations",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "contactNames",
    label: "Contacts",
    group: "Associations",
    isDefault: false,
    filterType: "text",
  },
];
