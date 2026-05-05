import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
import { US_STATES } from "@/lib/states";

export const STATUS_VALUES = [
  { value: "untriaged", label: "Untriaged" },
  { value: "district",  label: "Mapped to district" },
  { value: "state",     label: "Mapped to state-only" },
  { value: "non_lea",   label: "Dismissed (non-LEA)" },
  { value: "all",       label: "All" },
] as const;

export const agencyDistrictMapColumns: ColumnDef[] = [
  // status is filter-only — drives the API status param, isn't a row cell.
  { key: "status",             label: "Status",       group: "filters",  isDefault: false, filterType: "enum",   enumValues: [...STATUS_VALUES], isFilterOnly: true, sortable: false },
  { key: "agencyName",         label: "Agency",       group: "core",     isDefault: true,  filterType: "text",                                                       sortable: true  },
  { key: "stateAbbrev",        label: "State",        group: "core",     isDefault: true,  filterType: "enum",   enumValues: US_STATES.map((s) => ({ value: s, label: s })),          sortable: false },
  { key: "totalRfpCount",      label: "RFPs",         group: "metrics",  isDefault: true,  filterType: "number",                                                     sortable: true  },
  { key: "unresolvedRfpCount", label: "Unresolved",   group: "metrics",  isDefault: true,  filterType: "number",                                                     sortable: true  },
  { key: "totalValue",         label: "Total value",  group: "metrics",  isDefault: true,  filterType: "number",                                                     sortable: true  },
  { key: "latestCaptured",     label: "Latest seen",  group: "dates",    isDefault: true,  filterType: "date",                                                       sortable: true  },
  { key: "soonestOpenDue",     label: "Soonest due",  group: "dates",    isDefault: false, filterType: "date",                                                       sortable: true  },
  { key: "mappingStatus",      label: "Resolution",   group: "core",     isDefault: false, filterType: "text",                                                       sortable: false },
  { key: "resolvedBy",         label: "Resolved by",  group: "audit",    isDefault: false, filterType: "text",                                                       sortable: false },
  { key: "resolvedAt",         label: "Resolved at",  group: "audit",    isDefault: false, filterType: "date",                                                       sortable: false },
  { key: "agencyPath",         label: "HigherGov",    group: "audit",    isDefault: false, filterType: "text",                                                       sortable: false },
];
