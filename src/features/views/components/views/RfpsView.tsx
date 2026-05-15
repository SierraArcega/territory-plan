"use client";
import GridView from "../grid/GridView";
import type { ViewBodyProps } from "./_shared";

export default function RfpsView({ leaids, parentKind, parentId, savedLayouts }: ViewBodyProps) {
  return (
    <GridView
      source="rfps"
      leaids={leaids}
      listId={null}
      parentKind={parentKind}
      parentId={parentId}
      viewType="rfps"
      savedLayouts={savedLayouts}
    />
  );
}
