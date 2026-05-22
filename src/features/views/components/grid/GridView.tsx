"use client";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import { GridSortChips } from "./GridSortChips";
import { GridGroupChip } from "./GridGroupChip";
import { GridColumnMenu } from "./GridColumnMenu";
import { RowActionsMenu } from "./actions/RowActionsMenu";
import { ChurnRiskCell } from "./cells/ChurnRiskCell";
import { DistrictNotesCell } from "./cells/DistrictNotesCell";
import { CustomerRankCell } from "./cells/CustomerRankCell";
import { noteTypeMeta } from "../../lib/note-types";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ViewScroll,
} from "../views/_shared";
import GridPager from "./GridPager";
import { GRID_PAGE_SIZE } from "./grid-pagination";

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
  if (format === "date") {
    if (typeof v !== "string" && !(v instanceof Date)) return String(v);
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return String(v);
    // Short-format ("Jun 15, 2026") matches the rest of the app's date chrome.
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
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
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );

  // When the grid lives inside a plan, forward the planId so virtual fields
  // like `has_target` can compile their EXISTS subquery on the backend.
  const planId = parentKind === "plan" ? parentId ?? null : null;
  const showRowActions = parentKind === "plan" && source === "districts" && planId != null;

  // Reset to the first page whenever the query that defines the result set
  // changes (scope, filters, sort, or grouping). Done during render — React's
  // "adjust state when a prop changes" pattern — so this same render already
  // fetches page 1 instead of briefly requesting a now-invalid offset (e.g.
  // page 12 of a result that just shrank to 30 rows).
  const querySig = [
    source,
    leaids ? leaids.slice().sort().join(",") : "",
    listId ?? "",
    planId ?? "",
    JSON.stringify(layout.filters),
    JSON.stringify(layout.sort),
    layout.groupBy?.id ?? "",
  ].join("|");
  const [prevQuerySig, setPrevQuerySig] = useState(querySig);
  let effectivePage = page;
  if (prevQuerySig !== querySig) {
    setPrevQuerySig(querySig);
    setPage(1);
    effectivePage = 1;
  }

  // One fixed-size window per fetch (offset paging), so we never exceed the
  // backend's 200-row LIMIT cap and every page is reachable.
  const limit = GRID_PAGE_SIZE;
  const offset = (effectivePage - 1) * GRID_PAGE_SIZE;
  const q = useViewsData({ source, leaids, listId, planId, layout, limit, offset });

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
  // Memoized so visibleCols — and the tanCols cell fns derived from it — keep a
  // STABLE identity across renders. Otherwise every render builds new cell
  // functions, which flexRender renders as a new component type, so React
  // remounts every cell (losing e.g. an open notes popover) on each re-render.
  const columnsKey = JSON.stringify(layout.columns);
  const visibleCols = useMemo(
    () =>
      SOURCE_COLUMNS[source]
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
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, columnsKey],
  );

  const tanCols: TanColumnDef<Record<string, unknown>>[] = useMemo(() =>
    visibleCols.map((c) => ({
      id: c.id,
      header: c.header,
      accessorKey: c.accessor,
      cell: (info) => {
        const v = info.getValue();
        const row = info.row.original as Record<string, unknown>;
        const leaid = typeof row.leaid === "string" ? row.leaid : null;

        if (c.id === "customer_rank") {
          return <CustomerRankCell value={typeof v === "string" ? v : null} />;
        }
        if (c.id === "churn_risk" && leaid) {
          return (
            <ChurnRiskCell
              value={typeof v === "string" ? v : null}
              planId={planId}
              leaid={leaid}
              disabled={planId == null}
            />
          );
        }
        if (c.id === "plan_notes" && leaid) {
          return (
            <DistrictNotesCell
              leaid={leaid}
              districtName={typeof row.name === "string" ? row.name : leaid}
              latest={typeof row.notesLatest === "string" ? row.notesLatest : null}
              count={typeof row.notesCount === "number" ? row.notesCount : 0}
              latestType={typeof row.notesLatestType === "string" ? row.notesLatestType : null}
            />
          );
        }
        if (c.id === "note_type") {
          const t = typeof row.notesLatestType === "string" ? row.notesLatestType : null;
          return t
            ? <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${noteTypeMeta(t).pill}`}>{noteTypeMeta(t).label}</span>
            : <span className="text-[#A69DC0]">—</span>;
        }
        if (c.id === "name" && showRowActions && leaid) {
          // Action trigger sits in front of the district name (replaces the
          // old right-edge column) so the add affordance hugs each row's label.
          return (
            <span className="flex items-center gap-2">
              <RowActionsMenu
                planId={planId!}
                leaid={leaid}
                districtName={typeof v === "string" ? v : String(row.name ?? "")}
              />
              <span className="truncate">{formatCellValue(v, c.format)}</span>
            </span>
          );
        }
        if (v == null) return <span className="text-[#A69DC0]">—</span>;
        return <span>{formatCellValue(v, c.format)}</span>;
      },
    })),
    [visibleCols, planId],
  );

  // Compute contiguous group spans for the optional grouped header row.
  // Adjacent visible columns sharing the same `group` merge into one span.
  const groupSpans: { group: string | undefined; count: number }[] = [];
  for (const c of visibleCols) {
    const last = groupSpans[groupSpans.length - 1];
    if (last && last.group === c.group) {
      last.count += 1;
    } else {
      groupSpans.push({ group: c.group, count: 1 });
    }
  }
  const hasGroups = groupSpans.some((s) => s.group !== undefined);

  const table = useReactTable({
    data: q.data?.rows ?? [],
    columns: tanCols,
    getCoreRowModel: getCoreRowModel(),
    // Stable row identity so a data refetch maps rows by id (not array index),
    // preserving each row's cells (and any open popover state) instead of
    // remounting the whole body.
    getRowId: (row, index) => String(row.id ?? row.leaid ?? index),
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

  const groupBy = layout.groupBy ?? null;
  const groupColumn = groupBy
    ? SOURCE_COLUMNS[source].find((c) => c.id === groupBy.id) ?? null
    : null;

  function groupKeyFor(rowData: Record<string, unknown>): string {
    if (!groupColumn) return "";
    const raw = rowData[groupColumn.accessor];
    if (raw === null || raw === undefined || raw === "") return "__nogroup__";
    return String(raw);
  }

  function groupLabelFor(key: string): string {
    if (key === "__nogroup__") return "— No value —";
    if (!groupColumn) return key;
    // Boolean toggle columns serialize as "true"/"false"; pass through the
    // cell formatter so headers read "Yes"/"No" like the rest of the table.
    if (groupColumn.format === "boolean") {
      if (key === "true") return formatCellValue(true, "boolean");
      if (key === "false") return formatCellValue(false, "boolean");
    }
    return key;
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const colCount = visibleCols.length + 1;

  function renderBody() {
    const tableRows = table.getRowModel().rows;

    if (!groupColumn) {
      return tableRows.map((row) => {
        const original = row.original as Record<string, unknown>;
        return (
          <tr
            key={row.id}
            className="hover:bg-[#F7F5FA] transition-colors duration-100"
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className="py-2.5 px-3.5 border-b border-[#EFEDF5] whitespace-nowrap"
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
            {/* Matching spacer cell — keeps the column count consistent
                so the spacer header has a body counterpart. */}
            <td aria-hidden className="border-b border-[#EFEDF5]" />
          </tr>
        );
      });
    }

    // Walk rows, splitting into groups by changing key. Null group is
    // captured separately and re-emitted at the end under "— No value —".
    type Bucket = {
      key: string;
      rows: { row: (typeof tableRows)[number] }[];
    };
    const ordered: Bucket[] = [];
    let nullBucket: Bucket | null = null;
    let current: Bucket | null = null;

    for (const row of tableRows) {
      const original = row.original as Record<string, unknown>;
      const key = groupKeyFor(original);
      const entry = { row };

      if (key === "__nogroup__") {
        if (!nullBucket) nullBucket = { key, rows: [] };
        nullBucket.rows.push(entry);
        continue;
      }

      if (!current || current.key !== key) {
        current = { key, rows: [entry] };
        ordered.push(current);
      } else {
        current.rows.push(entry);
      }
    }

    const buckets: Bucket[] = nullBucket ? [...ordered, nullBucket] : ordered;
    const nodes: ReactNode[] = [];

    for (const bucket of buckets) {
      const collapsed = collapsedGroups.has(bucket.key);
      const Chev = collapsed ? ChevronRight : ChevronDown;
      nodes.push(
        <tr
          key={`grp-${bucket.key}`}
          data-group-key={bucket.key}
          onClick={() => toggleGroup(bucket.key)}
          // sticky top:36px aligns the group header just below the column
          // header row (~36px tall) so both stay pinned while body scrolls.
          className="cursor-pointer bg-[#F7F5FA] hover:bg-[#EFEDF5]"
          style={{ position: "sticky", top: 36 }}
        >
          <td
            colSpan={colCount}
            className="border-b border-[#EFEDF5] px-3.5 py-2"
          >
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[#403770]">
              <Chev className="h-3.5 w-3.5" />
              <span className="whitespace-nowrap uppercase tracking-[0.06em]">
                {groupLabelFor(bucket.key)}
              </span>
              <span className="whitespace-nowrap text-[#8A80A8]">
                · {bucket.rows.length} rows
              </span>
            </div>
          </td>
        </tr>,
      );

      if (collapsed) continue;

      for (const { row } of bucket.rows) {
        const original = row.original as Record<string, unknown>;
        nodes.push(
          <tr
            key={row.id}
            className="hover:bg-[#F7F5FA] transition-colors duration-100"
          >
            {row.getVisibleCells().map((cell) => (
              <td
                key={cell.id}
                className="py-2.5 px-3.5 border-b border-[#EFEDF5] whitespace-nowrap"
              >
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
            <td aria-hidden className="border-b border-[#EFEDF5]" />
          </tr>,
        );
      }
    }

    return nodes;
  }

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
        <div className="min-w-0 flex-1 flex items-center gap-2 overflow-x-auto px-3 py-2">
          <GridFilterChips
            source={source}
            layout={layout}
            onChange={setLayout}
          />
          <GridSortChips
            source={source}
            layout={layout}
            onChange={setLayout}
          />
          <GridGroupChip
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
          {/* `sticky` on `<thead>` keeps both the group row and the column
              header row pinned together when the body scrolls vertically. */}
          <thead className="sticky top-0 z-[1]">
            {hasGroups && (
              <tr className="bg-[#F7F5FA]">
                {groupSpans.map((span, i) =>
                  span.group ? (
                    <th
                      key={`group-${i}`}
                      colSpan={span.count}
                      className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#403770] py-1.5 px-3.5 border-b border-[#EFEDF5] whitespace-nowrap text-left"
                    >
                      {span.group}
                    </th>
                  ) : (
                    <th
                      key={`group-${i}`}
                      colSpan={span.count}
                      aria-hidden
                      className="py-1.5 border-b border-[#EFEDF5]"
                    />
                  ),
                )}
                <th aria-hidden className="border-b border-[#EFEDF5]" />
              </tr>
            )}
            <tr className="bg-[#F7F5FA]">
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
              {/* Spacer header — `width: 100%` claims any leftover horizontal
                  space so the real columns can shrink to their content width
                  instead of stretching to fill the screen. */}
              <th
                aria-hidden
                style={{ width: "100%" }}
                className="border-b border-[#D4CFE2] bg-[#F7F5FA]"
              />
            </tr>
          </thead>
          <tbody>
            {renderBody()}
          </tbody>
        </table>
      </div>
      {total > GRID_PAGE_SIZE && (
        <GridPager
          total={total}
          page={effectivePage}
          pageSize={GRID_PAGE_SIZE}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
