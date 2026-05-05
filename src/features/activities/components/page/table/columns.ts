import type { ColumnDef } from "@/features/shared/components/DataGrid";

// Column metadata for the Activities Table view. The `key` corresponds
// to a field on `ActivityListItem` (or a derived label, e.g. "owner"
// reads `ownerFullName`). `isDefault: true` marks the Wide-bundle 8 from
// the spec; the rest are picker-only.
export const ACTIVITIES_TABLE_COLUMNS: ColumnDef[] = [
  { key: "date",     label: "Date",     group: "Core",    isDefault: true,  filterType: "date",     width: 140 },
  { key: "type",     label: "Type",     group: "Core",    isDefault: true,  filterType: "enum",     width: 160 },
  { key: "title",    label: "Title",    group: "Core",    isDefault: true,  filterType: "text",     width: 260 },
  { key: "district", label: "District", group: "Linked",  isDefault: true,  filterType: "relation", width: 200 },
  { key: "contact",  label: "Contact",  group: "Linked",  isDefault: true,  filterType: "relation", width: 180, sortable: false },
  { key: "owner",    label: "Owner",    group: "Core",    isDefault: true,  filterType: "relation", width: 140 },
  { key: "status",   label: "Status",   group: "Core",    isDefault: true,  filterType: "enum",     width: 130 },
  { key: "outcome",  label: "Outcome notes", group: "Core", isDefault: true, filterType: "text",   width: 320, sortable: false },
  // Picker-only — hidden by default.
  { key: "inPerson",   label: "In person",   group: "Other",  isDefault: false, filterType: "boolean" },
  { key: "states",     label: "States",      group: "Other",  isDefault: false, filterType: "tags",     sortable: false },
  { key: "createdAt",  label: "Created at",  group: "Audit",  isDefault: false, filterType: "date" },
];

export const COLUMN_KEYS = ACTIVITIES_TABLE_COLUMNS.map((c) => c.key);
export const DEFAULT_COLUMN_KEYS = ACTIVITIES_TABLE_COLUMNS.filter((c) => c.isDefault).map((c) => c.key);

export function getColumnDef(key: string): ColumnDef | undefined {
  return ACTIVITIES_TABLE_COLUMNS.find((c) => c.key === key);
}
