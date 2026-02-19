// Column definitions for the Plans entity in the Explore data table.
// Keys match the field names returned by GET /api/explore/plans.

import type { ColumnDef } from "./districtColumns";

export const planColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "name",
    label: "Plan Name",
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
    enumValues: ["planning", "working", "stale", "archived"],
  },
  {
    key: "fiscalYear",
    label: "Fiscal Year",
    group: "Core",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "ownerName",
    label: "Owner",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "districtCount",
    label: "Districts",
    group: "Core",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "description",
    label: "Description",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },
  {
    key: "stateCount",
    label: "States",
    group: "Core",
    isDefault: false,
    filterType: "number",
  },
  {
    key: "color",
    label: "Color",
    group: "Core",
    isDefault: false,
    filterType: "text",
  },

  // ---- Targets ----
  {
    key: "totalTargets",
    label: "Total Targets ($)",
    group: "Targets",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "renewalRollup",
    label: "Renewal Rollup ($)",
    group: "Targets",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "expansionRollup",
    label: "Expansion Rollup ($)",
    group: "Targets",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "winbackRollup",
    label: "Win Back Rollup ($)",
    group: "Targets",
    isDefault: true,
    filterType: "number",
  },
  {
    key: "newBusinessRollup",
    label: "New Business Rollup ($)",
    group: "Targets",
    isDefault: true,
    filterType: "number",
  },

  // ---- Dates ----
  {
    key: "createdAt",
    label: "Created",
    group: "Dates",
    isDefault: true,
    filterType: "date",
  },
  {
    key: "updatedAt",
    label: "Updated",
    group: "Dates",
    isDefault: true,
    filterType: "date",
  },
];
