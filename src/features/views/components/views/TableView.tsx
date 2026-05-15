"use client";

/**
 * TableView — districts table for the active plan/list scope.
 *
 * This component is a thin wrapper over the shared GridView. All column
 * visibility, sort, filter, and persistence logic lives in GridView via
 * useGridLayout. The "table" view-type slot in the parent's viewLayouts blob
 * is managed automatically — changes are debounced and PATCHed to the server.
 *
 * Formerly this component had its own hand-rolled table and data-fetch; that
 * code has been replaced by GridView (Task C1). The old `formatMoney` helper
 * is still re-exported for KanbanView's card pills.
 */
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function TableView({
  leaids,
  parentKind,
  parentId,
  savedLayouts,
}: ViewBodyProps) {
  return (
    <GridView
      source="districts"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="table"
      savedLayouts={savedLayouts}
    />
  );
}

// Re-export for KanbanView card pills (previously lived in this file).
export function formatMoney(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}
