"use client";
import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef as TanColumnDef } from "@tanstack/react-table";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import { SOURCE_COLUMNS } from "@/features/views/lib/columns";
import { useViewsData } from "@/features/views/hooks/useViewsData";
import { GridHeaderCell } from "./GridHeaderCell";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ShowMoreButton,
  ViewScroll,
} from "../views/_shared";

interface GridViewProps {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;
  layout: GridViewLayout;
  // Optional: when provided, sort-header clicks propagate layout changes upward.
  // In B8 this will be wired to useGridLayout (debounced PATCH). When absent,
  // the sort header still renders as clickable but changes are no-ops.
  onLayoutChange?: (next: GridViewLayout) => void;
}

const PAGE_SIZE = 50;

export default function GridView({
  source,
  leaids,
  listId,
  layout,
  onLayoutChange,
}: GridViewProps) {
  const [page, setPage] = useState(1);
  const limit = page * PAGE_SIZE;
  const q = useViewsData({ source, leaids, listId, layout, limit, offset: 0 });

  // Single-sort mode: one column active at a time. Multi-sort (shift-click) comes in E3.
  function handleSortChange(columnId: string, dir: "asc" | "desc" | null) {
    const nextSort =
      dir === null
        ? layout.sort.filter((s) => s.id !== columnId)
        : layout.sort.some((s) => s.id === columnId)
          ? layout.sort.map((s) => (s.id === columnId ? { ...s, dir } : s))
          : [{ id: columnId, dir }]; // replace all — single-sort
    onLayoutChange?.({ ...layout, sort: nextSort });
  }

  // Compute visible columns from the layout overlaid on SOURCE_COLUMNS defaults.
  const visibleCols = SOURCE_COLUMNS[source]
    .filter((c) => {
      const entry = layout.columns.find((l) => l.id === c.id);
      return entry ? entry.visible : c.defaultVisible;
    })
    .sort((a, b) => {
      const oa =
        layout.columns.find((l) => l.id === a.id)?.order ?? a.defaultOrder;
      const ob =
        layout.columns.find((l) => l.id === b.id)?.order ?? b.defaultOrder;
      return oa - ob;
    });

  const tanCols: TanColumnDef<Record<string, unknown>>[] = visibleCols.map(
    (c) => ({
      id: c.id,
      header: c.header,
      accessorKey: c.accessor,
      cell: (info) => {
        const v = info.getValue();
        if (v == null) return <span className="text-[#A69DC0]">—</span>;
        return <span>{String(v)}</span>;
      },
    }),
  );

  const table = useReactTable({
    data: q.data?.rows ?? [],
    columns: tanCols,
    getCoreRowModel: getCoreRowModel(),
  });

  if (q.isLoading) return <LoadingState rows={8} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch rows.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.rows ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No matching rows"
        hint="Adjust filters or pick a different scope."
      />
    );
  }

  const total = q.data?.total ?? 0;
  const remaining = Math.max(0, total - rows.length);

  // data-row-kind for the existing detail-panel routing in GroupCanvas.
  const rowKind =
    source === "districts"
      ? "district"
      : source === "opps"
        ? "opp"
        : source === "contacts"
          ? "contact"
          : source === "vacancies"
            ? "vacancy"
            : source === "news"
              ? "news"
              : "rfp";

  return (
    <ViewScroll>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA] sticky top-0 z-[1]">
              {table.getHeaderGroups()[0].headers.map((h) => {
                const colDef = SOURCE_COLUMNS[source].find((c) => c.id === h.column.id);
                const sortDir = layout.sort.find((s) => s.id === h.column.id)?.dir ?? null;
                return (
                  <th
                    key={h.id}
                    className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap text-left"
                  >
                    <GridHeaderCell
                      label={colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}
                      sortable={colDef?.sortable ?? false}
                      sortDir={sortDir}
                      onSortChange={(dir) => handleSortChange(h.column.id, dir)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const original = row.original as Record<string, unknown>;
              const rowId = String(original.id ?? original.leaid ?? "");
              return (
                <tr
                  key={row.id}
                  data-row-kind={rowKind}
                  data-row-id={rowId}
                  className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="py-2.5 px-3.5 border-b border-[#EFEDF5]"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <ShowMoreButton onClick={() => setPage((p) => p + 1)} remaining={remaining} />
      )}
    </ViewScroll>
  );
}
