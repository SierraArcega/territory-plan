"use client";

/**
 * VacanciesView — thin wrapper over GridView for the vacancies source.
 *
 * All column visibility, sort, filter, and persistence logic lives in GridView
 * via useGridLayout. The "vacancies" view-type slot in the parent's viewLayouts
 * blob is managed automatically — changes are debounced and PATCHed to the server.
 *
 * Formerly this component had its own hand-rolled table and data-fetch; that
 * code has been replaced by GridView (Task D3).
 */
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function VacanciesView({ leaids, parentKind, parentId, savedLayouts }: ViewBodyProps) {
  return (
    <GridView
      source="vacancies"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="vacancies"
      savedLayouts={savedLayouts}
    />
  );
}
