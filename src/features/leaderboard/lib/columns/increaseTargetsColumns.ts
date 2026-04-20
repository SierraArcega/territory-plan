// Column definitions for the Increase Targets DataGrid.
// Keys match the IncreaseTarget response fields. Label "($)" suffix on
// fy26Revenue triggers the DataGrid's currency auto-detect.

import type { ColumnDef } from "@/features/shared/components/DataGrid/types";

export const increaseTargetsColumns: ColumnDef[] = [
  {
    key: "districtName",
    label: "District",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
  },
  {
    key: "state",
    label: "State",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
    width: 60,
  },
  {
    key: "fy26Revenue",
    label: "FY26 Revenue ($)",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "number",
    width: 110,
  },
  {
    key: "fy26SessionCount",
    label: "Sessions",
    group: "At-Risk Info",
    isDefault: false,
    filterType: "number",
    width: 80,
  },
  {
    key: "lastRepName",
    label: "Last Rep",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
    width: 130,
  },
  {
    key: "lastSaleSummary",
    label: "Last Sale",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
    width: 140,
    sortable: false,
  },
  {
    key: "products",
    label: "Products",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
    sortable: false,
  },
];
