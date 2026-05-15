"use client";
import { useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef as TanColumnDef } from "@tanstack/react-table";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type {
  GridViewLayout,
  ViewLayouts,
} from "@/lib/saved-views/grid-layout-schema";
import { SOURCE_COLUMNS } from "@/features/views/lib/columns";
import { useViewsData } from "@/features/views/hooks/useViewsData";
import {
  useGridLayout,
  type ViewTypeKey,
} from "@/features/views/hooks/useGridLayout";
import { GridHeaderCell } from "./GridHeaderCell";
import { GridFilterChips } from "./GridFilterChips";
import { GridColumnMenu } from "./GridColumnMenu";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ShowMoreButton,
  ViewScroll,
} from "../views/_shared";

/**
 * GridView — shared data-table for all entity sources.
 *
 * Layout state can be driven in two ways:
 *
 * A) Hook-driven (preferred for production use):
 *    Pass `parentKind`, `parentId`, `viewType`, and optionally `savedLayouts`.
 *    GridView calls `useGridLayout` internally and manages debounced persistence.
 *
 * B) Prop-driven (escape hatch for tests or controlled parents):
 *    Pass `layout` directly. `onLayoutChange` is called synchronously on every
 *    mutation. When `layout` is present it takes precedence over the hook.
 *
 * Never mix A and B in the same render — choose one.
 */
interface GridViewProps {
  source: SavedListSource;
  leaids: string[] | null;
  listId: string | null;

  // ── Option A: hook-driven layout ──────────────────────────────────────────
  /** "plan" or "list" — determines which PATCH endpoint useGridLayout targets. */
  parentKind?: "plan" | "list";
  /** Id of the plan or list that owns the persisted layout. */
  parentId?: string;
  /** Which slot in the viewLayouts blob this view occupies. */
  viewType?: ViewTypeKey;
  /** The full viewLayouts blob from the parent record (passed to useGridLayout). */
  savedLayouts?: ViewLayouts;

  // ── Option B: prop-driven layout (test escape hatch) ─────────────────────
  /** When provided, skips the hook and uses this layout directly. */
  layout?: GridViewLayout;
  /** Called synchronously on every layout mutation when using Option B. */
  onLayoutChange?: (next: GridViewLayout) => void;
}

const PAGE_SIZE = 50;

export default function GridView(props: GridViewProps) {
  const {
    source,
    leaids,
    listId,
    parentKind,
    parentId,
    viewType,
    savedLayouts,
    layout: layoutProp,
    onLayoutChange: onLayoutChangeProp,
  } = props;

  // ── Layout state: prop-driven (B) takes precedence over hook-driven (A) ──
  //
  // Rules of Hooks: useGridLayout must be called unconditionally. When using
  // Option B, we call the hook with placeholder values and discard its output.
  const isHookDriven = layoutProp === undefined;
  const hookResult = useGridLayout(
    isHookDriven && parentKind && parentId && viewType
      ? { parentKind, parentId, viewType, source, savedLayouts: savedLayouts ?? null }
      : // Placeholder args when using prop-driven mode — hook output is discarded.
        {
          parentKind: parentKind ?? "plan",
          parentId: parentId ?? "__noop__",
          viewType: viewType ?? "table",
          source,
          savedLayouts: savedLayouts ?? null,
        },
  );

  // Resolve the effective layout and setter.
  const layout: GridViewLayout = isHookDriven
    ? hookResult.layout
    : layoutProp!;
  const setLayout = isHookDriven
    ? hookResult.setLayout
    : (onLayoutChangeProp ?? (() => {}));

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
    setLayout({ ...layout, sort: nextSort });
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
      {/* Filter chips + column visibility gear on one row */}
      <div className="flex items-center border-b border-[#EFEDF5] bg-white">
        <div className="min-w-0 flex-1 overflow-x-auto">
          <GridFilterChips
            source={source}
            layout={layout}
            onChange={setLayout}
          />
        </div>
        <div className="shrink-0 px-2 py-2">
          <GridColumnMenu
            source={source}
            layout={layout}
            onChange={setLayout}
          />
        </div>
      </div>
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
