"use client";

/**
 * ContactsView — thin wrapper over GridView for the contacts source.
 *
 * All column visibility, sort, filter, and persistence logic lives in GridView
 * via useGridLayout. The "contacts" view-type slot in the parent's viewLayouts
 * blob is managed automatically — changes are debounced and PATCHed to the server.
 *
 * Formerly this component had its own hand-rolled table and data-fetch; that
 * code has been replaced by GridView (Task D1).
 */
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function ContactsView({ leaids, parentKind, parentId, savedLayouts }: ViewBodyProps) {
  return (
    <GridView
      source="contacts"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="contacts"
      savedLayouts={savedLayouts}
    />
  );
}
