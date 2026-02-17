// Column definitions for the Activities entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/activities.

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags";
  enumValues?: string[];
}

export interface ActivityRow {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  outcomeType: string | null;
  outcome: string | null;
  districtNames: string[];
  planNames: string[];
  contactNames: string[];
}

export const activityColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "title",
    label: "Title",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "type",
    label: "Type",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: [
      "conference",
      "road_trip",
      "email_campaign",
      "discovery_call",
      "demo",
      "proposal_review",
      "check_in",
      "onboarding",
      "training",
      "internal",
      "other",
    ],
  },
  {
    key: "status",
    label: "Status",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["planned", "completed", "cancelled"],
  },

  // ---- Scheduling ----
  {
    key: "startDate",
    label: "Start Date",
    group: "Scheduling",
    isDefault: true,
    filterType: "date",
  },
  {
    key: "endDate",
    label: "End Date",
    group: "Scheduling",
    isDefault: false,
    filterType: "date",
  },

  // ---- Outcomes ----
  {
    key: "outcomeType",
    label: "Outcome Type",
    group: "Outcomes",
    isDefault: true,
    filterType: "enum",
    enumValues: [
      "positive_progress",
      "neutral",
      "negative",
      "follow_up_needed",
      "no_response",
      "not_applicable",
    ],
  },
  {
    key: "outcome",
    label: "Outcome Notes",
    group: "Outcomes",
    isDefault: false,
    filterType: "text",
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
