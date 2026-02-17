// Column definitions for the Districts entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/districts.

export interface ColumnDef {
  key: string;
  label: string;
  group: string;
  isDefault: boolean;
  filterType: "text" | "enum" | "number" | "boolean" | "date" | "tags";
  enumValues?: string[];
}

export interface DistrictRow {
  leaid: string;
  name: string;
  state: string;
  enrollment: number | null;
  isCustomer: boolean;
  hasOpenPipeline: boolean;
  fy26_open_pipeline_value: number | null;
  fy26_closed_won_net_booking: number | null;
  salesExecutive: string | null;
  urbanicity: string | null;
  graduationRate: number | null;
  mathProficiency: number | null;
  readProficiency: number | null;
  sped_percent: number | null;
  ell_percent: number | null;
  free_lunch_percent: number | null;
  accountType: string | null;
  tags: { id: string; name: string; color: string }[];
  planCount: number;
  lastActivity: string | null;
}

export const districtColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "name",
    label: "District Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "state",
    label: "State",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "leaid",
    label: "LEA ID",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "enrollment",
    label: "Enrollment",
    group: "Core",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "urbanicity",
    label: "Urbanicity",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "accountType",
    label: "Account Type",
    group: "Core",
    isDefault: false,
    filterType: "enum",
    enumValues: ["district", "charter", "esc", "other"],
  },

  // ---- CRM / Revenue ----
  {
    key: "isCustomer",
    label: "Customer",
    group: "CRM / Revenue",
    isDefault: true,
    filterType: "boolean",
  },
  {
    key: "hasOpenPipeline",
    label: "Open Pipeline",
    group: "CRM / Revenue",
    isDefault: false,
    filterType: "boolean",
  },
  {
    key: "fy26_open_pipeline_value",
    label: "FY26 Open Pipeline ($)",
    group: "CRM / Revenue",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "fy26_closed_won_net_booking",
    label: "FY26 Closed Won ($)",
    group: "CRM / Revenue",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "salesExecutive",
    label: "Sales Executive",
    group: "CRM / Revenue",
    isDefault: false,
    filterType: "text",
  },

  // ---- Education ----
  {
    key: "graduationRate",
    label: "Graduation Rate",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "mathProficiency",
    label: "Math Proficiency %",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "readProficiency",
    label: "Reading Proficiency %",
    group: "Education",
    isDefault: false,
    filterType: "number",
  },

  // ---- Demographics ----
  {
    key: "sped_percent",
    label: "SPED %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "ell_percent",
    label: "ELL %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "free_lunch_percent",
    label: "Poverty %",
    group: "Demographics",
    isDefault: false,
    filterType: "number",
  },

  // ---- Signals ----
  {
    key: "planCount",
    label: "Plans",
    group: "Signals",
    isDefault: true,
    filterType: "number",
  },

  // ---- Engagement ----
  {
    key: "lastActivity",
    label: "Last Activity",
    group: "Engagement",
    isDefault: true,
    filterType: "date",
  },
  {
    key: "tags",
    label: "Tags",
    group: "Engagement",
    isDefault: true,
    filterType: "tags",
  },
];
