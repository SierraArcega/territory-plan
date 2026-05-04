// Column definitions for the Unmatched Opportunities admin DataGrid.
// Keys match the field names returned by the unmatched opportunities API.

import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
import { US_STATES, stateDisplayName } from "@/lib/states";

export const unmatchedOpportunityColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "id",
    label: "Opp ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
    width: 120,
  },
  {
    key: "name",
    label: "Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
    width: 200,
  },
  {
    key: "accountName",
    label: "Account",
    group: "Core",
    isDefault: true,
    filterType: "text",
    width: 180,
  },
  {
    key: "accountLmsId",
    label: "Account LMS ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
    width: 110,
  },
  {
    key: "state",
    label: "State",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: US_STATES.map((abbrev) => ({
      value: abbrev,
      label: `${stateDisplayName(abbrev)} (${abbrev})`,
    })),
    width: 60,
  },
  {
    key: "schoolYr",
    label: "School Year",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["2024-25", "2025-26", "2026-27"],
    width: 90,
  },
  {
    key: "stage",
    label: "Stage",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from facets API
    width: 130,
  },
  {
    key: "reason",
    label: "Reason",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from facets API
    width: 150,
  },
  {
    key: "resolvedDistrictLeaid",
    label: "NCES ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
    width: 90,
  },
  {
    key: "resolved",
    label: "Status",
    group: "Core",
    isDefault: true,
    filterType: "boolean",
    width: 90,
  },

  // ---- Financial ----
  {
    key: "netBookingAmount",
    label: "Net Booking ($)",
    group: "Financial",
    isDefault: true,
    filterType: "number",
    width: 120,
  },

  // ---- Filters only (virtual — not a row field) ----
  {
    key: "rep",
    label: "Rep",
    group: "Filters",
    isDefault: false,
    isFilterOnly: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from useUsers() data
  },
];
