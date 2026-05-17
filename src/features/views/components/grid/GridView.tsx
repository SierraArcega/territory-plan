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
import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
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

function FilteredEmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
      <div className="text-[14px] font-medium text-[#403770]">No rows match your filters</div>
      <div className="text-[12px] text-[#8A80A8]">Try widening or removing filters.</div>
      <button
        type="button"
        onClick={onClear}
        className="mt-2 rounded bg-[#403770] px-3 py-1 text-[12px] text-white hover:bg-[#322a5a]"
      >
        Clear filters
      </button>
    </div>
  );
}

function TruncatedBanner() {
  return (
    <div className="border-b border-[#FFCF70] bg-[#FFF7E6] px-3 py-1.5 text-[12px] text-[#997c43]">
      Result too large — narrow your filters.
    </div>
  );
}

function formatCellValue(
  v: unknown,
  format:
    | "money"
    | "number"
    | "percent"
    | "date"
    | "pill"
    | "text"
    | "avatar"
    | "boolean",
): string {
  if (format === "money") {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n)
      ? formatCurrency(n, true)
      : String(v);
  }
  if (format === "number") {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n)
      ? formatNumber(n)
      : String(v);
  }
  if (format === "percent") {
    const n = typeof v === "string" ? Number(v) : v;
    // DB columns like frpl_rate store 0..1; formatPercent multiplies by 100.
    return typeof n === "number" && Number.isFinite(n)
      ? formatPercent(n)
      : String(v);
  }
  if (format === "boolean") {
    if (v === true) return "Yes";
    if (v === false) return "No";
    return String(v);
  }
  return String(v);
}

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
  // When the grid lives inside a plan, forward the planId so virtual fields
  // like `has_target` can compile their EXISTS subquery on the backend.
  const planId = parentKind === "plan" ? parentId ?? null : null;
  const q = useViewsData({ source, leaids, listId, planId, layout, limit, offset: 0 });

  function handleSortChange(columnId: string, dir: "asc" | "desc" | null, shift: boolean) {
    const existing = layout.sort.findIndex((s) => s.id === columnId);
    let nextSort: typeof layout.sort;

    if (!shift) {
      // Single-sort: replace the entire stack.
      nextSort = dir ? [{ id: columnId, dir }] : [];
    } else {
      // Multi-sort: add/update/remove this column within the stack.
      if (dir === null) {
        nextSort = layout.sort.filter((s) => s.id !== columnId);
      } else if (existing >= 0) {
        nextSort = layout.sort.slice();
        nextSort[existing] = { id: columnId, dir };
      } else {
        nextSort = [...layout.sort, { id: columnId, dir }];
      }
    }

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
        return <span>{formatCellValue(v, c.format)}</span>;
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
  const filtersActive = layout.filters.children.length > 0;
  const truncated = q.data?.truncated === true;

  if (rows.length === 0) {
    if (filtersActive) {
      return (
        <ViewScroll>
          {truncated && <TruncatedBanner />}
          <FilteredEmptyState
            onClear={() =>
              setLayout({ ...layout, filters: { kind: "and", children: [] } })
            }
          />
        </ViewScroll>
      );
    }
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
    <div
      className="h-full flex flex-col bg-[#FFFCFA]"
      // Per CLAUDE.md mobile guidance: pan-y opt-in on iOS for inner scroll.
      style={{ touchAction: "pan-y" }}
    >
      {/* Filter chips + column visibility gear on one row. shrink-0 so the
          strip keeps its natural height when the table area below grows. */}
      {/* touch-action:auto overrides the ancestor pan-y so the chip strip can
          scroll horizontally on iOS without fighting the outer pan lock. */}
      <div
        className="shrink-0 flex items-center border-b border-[#EFEDF5] bg-white"
        style={{ touchAction: "auto" }}
      >
        <div className="min-w-0 flex-1">
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
      {truncated && <TruncatedBanner />}
      {/* Single scroll context for the whole table — both axes. The thead's
          `sticky top-0` keeps headers pinned while the body scrolls
          vertically; horizontal scroll moves header and body together so
          columns stay aligned. */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#F7F5FA] sticky top-0 z-[1]">
              {table.getHeaderGroups()[0].headers.map((h) => {
                const colDef = SOURCE_COLUMNS[source].find((c) => c.id === h.column.id);
                const sortIndexInStack = layout.sort.findIndex((s) => s.id === h.column.id);
                const sortEntry = sortIndexInStack >= 0 ? layout.sort[sortIndexInStack] : undefined;
                const sortDir = sortEntry?.dir ?? null;
                const showIndex = layout.sort.length > 1 && sortIndexInStack >= 0;
                const colId = h.column.id;
                const colWidth = layout.columns.find((c) => c.id === colId)?.width;
                return (
                  <th
                    key={h.id}
                    style={{ width: colWidth ? `${colWidth}px` : undefined, position: "relative" }}
                    className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap text-left"
                  >
                    <GridHeaderCell
                      label={colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}
                      sortable={colDef?.sortable ?? false}
                      sortDir={sortDir}
                      sortIndex={showIndex ? sortIndexInStack + 1 : undefined}
                      onSortChange={(dir, shift) => handleSortChange(h.column.id, dir, shift)}
                      width={colWidth}
                      onWidthChange={(w) => {
                        const allColIds = SOURCE_COLUMNS[source].map((c) => c.id);
                        const merged = allColIds.map((id) => {
                          const existing = layout.columns.find((c) => c.id === id);
                          const def = SOURCE_COLUMNS[source].find((c) => c.id === id)!;
                          const base = existing ?? { id, order: def.defaultOrder, visible: def.defaultVisible };
                          return id === colId ? { ...base, width: w } : base;
                        });
                        setLayout({ ...layout, columns: merged });
                      }}
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
        <div className="shrink-0">
          <ShowMoreButton onClick={() => setPage((p) => p + 1)} remaining={remaining} />
        </div>
      )}
    </div>
  );
}
