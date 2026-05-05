"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Filter } from "lucide-react";
import {
  useActivitiesChrome,
  type ActivitySortKey,
} from "@/features/activities/lib/filters-store";
import type { ColumnDef } from "@/features/shared/components/DataGrid";
import ColumnFilterPopover from "./ColumnFilterPopover";
import { cn } from "@/features/shared/lib/cn";

interface ActivitiesTableHeaderProps {
  visibleColumnDefs: ColumnDef[];
  selectAllChecked: boolean;
  onTogglePageSelection: () => void;
}

const FILTERABLE_KEYS = new Set([
  "date",
  "type",
  "title",
  "district",
  "contact",
  "owner",
  "status",
  "outcome",
  "createdAt",
]);

const SORT_KEY_BY_COLUMN: Record<string, ActivitySortKey> = {
  date: "date",
  type: "type",
  title: "title",
  district: "district",
  owner: "owner",
  status: "status",
};

// Activity column header row. Each column label is a sort button (cycles
// asc → desc); a small ▾ icon next to it opens the column's filter popover.
// The filter trigger gets a coral dot when that column has an active filter.
export default function ActivitiesTableHeader({
  visibleColumnDefs,
  selectAllChecked,
  onTogglePageSelection,
}: ActivitiesTableHeaderProps) {
  const sorts = useActivitiesChrome((s) => s.tableSorts);
  const setTableSorts = useActivitiesChrome((s) => s.setTableSorts);
  const filters = useActivitiesChrome((s) => s.filters);
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  const primarySort = sorts[0];

  function isSortable(key: string) {
    const def = visibleColumnDefs.find((c) => c.key === key);
    if (def?.sortable === false) return false;
    return key in SORT_KEY_BY_COLUMN;
  }

  function clickSort(columnKey: string) {
    if (!isSortable(columnKey)) return;
    const sortKey = SORT_KEY_BY_COLUMN[columnKey];
    // Cycle: not-sorted → asc → desc → not-sorted (default re-applies).
    if (primarySort?.column === sortKey) {
      if (primarySort.direction === "asc") {
        setTableSorts([{ column: sortKey, direction: "desc" }]);
      } else {
        setTableSorts([{ column: "date", direction: "desc" }]); // back to default
      }
    } else {
      setTableSorts([{ column: sortKey, direction: "asc" }]);
    }
  }

  function isFiltered(columnKey: string): boolean {
    switch (columnKey) {
      case "date":
        return Boolean(filters.dateFrom) || Boolean(filters.dateTo);
      case "type":
        return filters.categories.length > 0 || filters.types.length > 0;
      case "owner":
        return filters.owners.length > 0;
      case "status":
        return filters.statuses.length > 0;
      case "district":
        return filters.districts.length > 0;
      case "contact":
        return filters.contactIds.length > 0;
      case "title":
      case "outcome":
        return Boolean(filters.text);
      default:
        return false;
    }
  }

  return (
    <thead className="sticky top-0 z-10 bg-[#F7F5FA] border-b border-[#E2DEEC]">
      <tr>
        <th className="w-8 px-3 py-2 text-left">
          <input
            type="checkbox"
            aria-label="Select page"
            checked={selectAllChecked}
            onChange={onTogglePageSelection}
            className="cursor-pointer accent-[#403770]"
          />
        </th>
        {visibleColumnDefs.map((col) => {
          const sortKey = SORT_KEY_BY_COLUMN[col.key];
          const isActiveSort = sortKey && primarySort?.column === sortKey;
          const filtered = isFiltered(col.key);
          const filterable = FILTERABLE_KEYS.has(col.key);
          return (
            <th
              key={col.key}
              className="relative px-3 py-2 text-left whitespace-nowrap"
              style={col.width ? { minWidth: col.width } : undefined}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => clickSort(col.key)}
                  disabled={!isSortable(col.key)}
                  className={cn(
                    "inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#544A78]",
                    "disabled:cursor-default",
                    isSortable(col.key) && "hover:text-[#403770]"
                  )}
                  aria-sort={
                    isActiveSort
                      ? primarySort.direction === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                  }
                >
                  {col.label}
                  {isActiveSort && (primarySort.direction === "asc"
                    ? <ChevronUp className="w-3 h-3" />
                    : <ChevronDown className="w-3 h-3" />)}
                </button>
                {filterable && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenFilter(openFilter === col.key ? null : col.key);
                    }}
                    aria-label={`Filter ${col.label}`}
                    aria-expanded={openFilter === col.key}
                    className={cn(
                      "relative inline-flex items-center justify-center w-4 h-4 rounded text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5]",
                      filtered && "text-[#F37167]"
                    )}
                  >
                    <Filter className="w-3 h-3" />
                    {filtered && (
                      <span aria-hidden className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#F37167]" />
                    )}
                  </button>
                )}
              </div>
              {openFilter === col.key && (
                <ColumnFilterPopover
                  columnKey={col.key}
                  onClose={() => setOpenFilter(null)}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
