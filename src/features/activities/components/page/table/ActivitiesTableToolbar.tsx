"use client";

import { useEffect, useState } from "react";
import { Search, RotateCcw } from "lucide-react";
import {
  useActivitiesChrome,
  EMPTY_FILTERS,
  DEFAULT_TABLE_COLUMNS,
  DEFAULT_TABLE_SORTS,
} from "@/features/activities/lib/filters-store";
import { useProfile } from "@/features/shared/lib/queries";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import ColumnsPicker from "./ColumnsPicker";
import ExportMenu from "./ExportMenu";

interface ActivitiesTableToolbarProps {
  selectedRows: ActivityListItem[];
  filteredRows: ActivityListItem[];
}

// Top-of-table toolbar: full-width text search, reset button (only when any
// filter is active), export menu, columns picker. The search input is
// debounced 250ms before writing to filters.text — typing into the input
// shouldn't fire a query on every keystroke.
export default function ActivitiesTableToolbar({
  selectedRows,
  filteredRows,
}: ActivitiesTableToolbarProps) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const setTableSorts = useActivitiesChrome((s) => s.setTableSorts);
  const setTableVisibleColumns = useActivitiesChrome((s) => s.setTableVisibleColumns);
  const visibleColumns = useActivitiesChrome((s) => s.tableVisibleColumns);
  const { data: profile } = useProfile();

  const [search, setSearch] = useState(filters.text);

  // Local→store debounce. The local input is the source of truth while the
  // user is typing; we flush to the Zustand store after 250ms of idle.
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== filters.text) {
        patchFilters({ text: search.trim() });
      }
    }, 250);
    return () => clearTimeout(t);
    // Intentionally not depending on filters.text — only the local input drives writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, patchFilters]);

  // Store→local sync. Only reacts to filters.text changing (e.g. Reset button,
  // saved view). Critically NOT depending on `search` — if it did, every
  // keystroke would race with the debounced flush above and wipe the input.
  useEffect(() => {
    setSearch(filters.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.text]);

  const hasActiveFilter =
    filters.categories.length > 0 ||
    filters.types.length > 0 ||
    filters.statuses.length > 0 ||
    filters.attendeeIds.length > 0 ||
    filters.districts.length > 0 ||
    filters.contactIds.length > 0 ||
    filters.inPerson.length > 0 ||
    filters.states.length > 0 ||
    filters.territories.length > 0 ||
    filters.tags.length > 0 ||
    filters.dealKinds.length > 0 ||
    Boolean(filters.text.trim()) ||
    Boolean(filters.dateFrom) ||
    Boolean(filters.dateTo) ||
    // Default owner = my activities; treat anything beyond that as active.
    (filters.owners.length !== 1 || (profile?.id ? filters.owners[0] !== profile.id : true));

  function handleReset() {
    setSearch("");
    setTableSorts([...DEFAULT_TABLE_SORTS]);
    setTableVisibleColumns([...DEFAULT_TABLE_COLUMNS]);
    if (profile?.id) {
      patchFilters({ ...EMPTY_FILTERS, owners: [profile.id] });
    } else {
      patchFilters({ ...EMPTY_FILTERS });
    }
  }

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-[#E2DEEC]">
      <div className="relative flex-1 max-w-2xl">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, notes, district, contact…"
          className="w-full h-8 pl-8 pr-2.5 text-xs text-[#403770] placeholder:text-[#A69DC0] bg-white border border-[#D4CFE2] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>
      <div className="ml-auto flex items-center gap-2">
        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors fm-focus-ring"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
        <ExportMenu selectedRows={selectedRows} filteredRows={filteredRows} />
        <ColumnsPicker
          visibleColumns={visibleColumns}
          onChange={setTableVisibleColumns}
        />
      </div>
    </div>
  );
}
