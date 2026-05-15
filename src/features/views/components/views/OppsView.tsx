"use client";

/**
 * OppsView — thin wrapper over GridView for the opps source.
 *
 * All column visibility, sort, filter, and persistence logic lives in GridView
 * via useGridLayout. The "opps" view-type slot in the parent's viewLayouts
 * blob is managed automatically — changes are debounced and PATCHed to the server.
 *
 * Formerly this component had its own hand-rolled table and data-fetch; that
 * code has been replaced by GridView (Task D2).
 */
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function OppsView({ leaids, parentKind, parentId, savedLayouts }: ViewBodyProps) {
  return (
    <GridView
      source="opps"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="opps"
      savedLayouts={savedLayouts}
    />
  );
}
