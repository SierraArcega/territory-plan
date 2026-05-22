"use client";

/**
 * KanbanToolbar — filter + within-column sort controls for the opp kanban.
 * Reuses the grid's chips for the SQL opp fields (Stage + School year excluded).
 * Rank controls are added in Part 2.
 */
import { GridFilterChips } from "../grid/GridFilterChips";
import { GridSortChips } from "../grid/GridSortChips";
import type { GridViewLayout, KanbanLayout } from "@/lib/saved-views/grid-layout-schema";

const EXCLUDE = ["stage", "school_yr"];

export function KanbanToolbar({
  layout,
  onChange,
}: {
  layout: KanbanLayout;
  onChange: (next: KanbanLayout) => void;
}) {
  const shim: GridViewLayout = {
    columns: [],
    sort: layout.sort,
    filters: layout.filters,
    groupBy: null,
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#EFEDF5] bg-white px-4 py-2">
      <GridFilterChips
        source="opps"
        layout={shim}
        excludeFieldIds={EXCLUDE}
        onChange={(next) => onChange({ ...layout, filters: next.filters })}
      />
      <GridSortChips
        source="opps"
        layout={shim}
        excludeFieldIds={EXCLUDE}
        onChange={(next) => onChange({ ...layout, sort: next.sort })}
      />
    </div>
  );
}
