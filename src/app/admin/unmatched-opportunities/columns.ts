// Column definitions for the Unmatched Opportunities admin DataGrid.
// Keys match the field names returned by the unmatched opportunities API.

import type { ColumnDef } from "@/features/shared/components/DataGrid/types";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "PR",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
];

export const unmatchedOpportunityColumns: ColumnDef[] = [
  // ---- Core ----
  {
    key: "id",
    label: "Opp ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "name",
    label: "Name",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "accountName",
    label: "Account",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "accountLmsId",
    label: "Account LMS ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "state",
    label: "State",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: US_STATES,
  },
  {
    key: "schoolYr",
    label: "School Year",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: ["2024-25", "2025-26", "2026-27"],
  },
  {
    key: "stage",
    label: "Stage",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from facets API
  },
  {
    key: "reason",
    label: "Reason",
    group: "Core",
    isDefault: true,
    filterType: "enum",
    enumValues: [], // populated at runtime from facets API
  },
  {
    key: "resolvedDistrictLeaid",
    label: "NCES ID",
    group: "Core",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "resolved",
    label: "Status",
    group: "Core",
    isDefault: true,
    filterType: "boolean",
  },

  // ---- Financial ----
  {
    key: "netBookingAmount",
    label: "Net Booking ($)",
    group: "Financial",
    isDefault: true,
    filterType: "number",
  },
];
