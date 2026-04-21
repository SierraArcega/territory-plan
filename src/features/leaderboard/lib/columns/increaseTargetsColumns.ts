// Column definitions for the Increase Targets DataGrid.
// Keys match the IncreaseTarget response fields. Label "($)" suffix on a
// numeric column triggers the DataGrid's currency auto-detect.

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
    width: 120,
  },
  {
    key: "fy26MinBookings",
    label: "FY26 Min Bookings ($)",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "number",
    width: 130,
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
    key: "fy27Status",
    label: "FY27 Status",
    group: "At-Risk Info",
    isDefault: true,
    filterType: "text",
    width: 180,
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
