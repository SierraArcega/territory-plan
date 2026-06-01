"use client";
import { useMemo, useState, useRef, type CSSProperties, type ReactNode } from "react";
import { ChevronDown, ChevronRight, ChevronLeft, Plus } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
} from "@tanstack/react-table";
import type { ColumnDef as TanColumnDef, Row as TanRow } from "@tanstack/react-table";
import { useIsMutating, useIsFetching } from "@tanstack/react-query";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type {
  GridViewLayout,
  ViewLayouts,
} from "@/lib/saved-views/grid-layout-schema";
import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import { formatCurrency, formatNumber, formatPercent } from "@/features/shared/lib/format";
import { useViewsData } from "@/features/views/hooks/useViewsData";
import {
  useGridLayout,
  type GridViewTypeKey,
} from "@/features/views/hooks/useGridLayout";
import { GridHeaderCell } from "./GridHeaderCell";
import { GridFilterChips } from "./GridFilterChips";
import { GridSortChips } from "./GridSortChips";
import { GridGroupChip } from "./GridGroupChip";
import { GridColumnMenu } from "./GridColumnMenu";
import { RowActionsMenu } from "./actions/RowActionsMenu";
import { BulkActionsMenu, type SelectionState } from "./actions/BulkActionsMenu";
import { AddDistrictsModal } from "./actions/AddDistrictsModal";
import { ChurnRiskCell } from "./cells/ChurnRiskCell";
import { DistrictNotesCell } from "./cells/DistrictNotesCell";
import { CustomerRankCell } from "./cells/CustomerRankCell";
import { TargetSubCell, type TargetField } from "./cells/TargetSubCell";
import { noteTypeMeta } from "../../lib/note-types";
import {
  LoadingState,
  ErrorState,
  EmptyState,
  ViewScroll,
} from "../views/_shared";
import GridPager from "./GridPager";
import { DEFAULT_PAGE_SIZE, BULK_SELECT_CAP, type PageSize } from "./grid-pagination";

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
  viewType?: GridViewTypeKey;
  /** The full viewLayouts blob from the parent record (passed to useGridLayout). */
  savedLayouts?: ViewLayouts;

  // ── Option B: prop-driven layout (test escape hatch) ─────────────────────
  /** When provided, skips the hook and uses this layout directly. */
  layout?: GridViewLayout;
  /** Called synchronously on every layout mutation when using Option B. */
  onLayoutChange?: (next: GridViewLayout) => void;
}

// State machine for TargetSumCell pending lifecycle.
// Defined at module scope so the type is available without re-declaring per render.
type SumPendingState = "idle" | "mutating" | "settled" | "fetching";

/**
 * Dims the target sum while a target mutation for this row is in-flight AND
 * through the subsequent refetch — so the italic/opacity and the updated
 * number both clear at the same moment.
 *
 * Uses a 4-state machine rather than a simple boolean latch because the latch
 * approach fails for concurrent row edits:
 *
 *   Row A settles → refetch 1 starts → refetch 1 completes (isFetching → 0)
 *   → latch for Row B clears, even though Row B's refetch hasn't started yet.
 *
 * The state machine fixes this by requiring a fetch to START *after* this row's
 * mutation has settled before it can advance to "idle". A fetch that was already
 * in-flight when the mutation settled is ignored.
 *
 *   idle → mutating → settled → fetching → idle
 */
function TargetSumCell({ value, leaid }: { value: unknown; leaid: string | null }) {
  const isMutating = useIsMutating({
    predicate: (mutation) => {
      const vars = mutation.state.variables as Record<string, unknown> | undefined;
      return vars?.leaid === leaid;
    },
  });
  const isFetching = useIsFetching({ queryKey: ["views", "data"] });

  const stateRef = useRef<SumPendingState>("idle");
  const prevMutatingRef = useRef(0);
  const prevFetchingRef = useRef(0);

  // All transition logic runs inline (not in effects) so isPending is correct on
  // the same render frame without needing an extra render cycle.

  let nextState = stateRef.current;

  // Mutation transitions — highest priority; evaluated first.
  if (isMutating > 0) {
    nextState = "mutating";
  } else if (prevMutatingRef.current > 0 && isMutating === 0) {
    // All mutations for this row just settled.
    nextState = "settled";
  }
  prevMutatingRef.current = isMutating;

  // Fetch transitions — run on the already-updated nextState so that a
  // settle + fetch-start in the same render (common when onSettled fires
  // synchronously) advances all the way to "fetching" in one pass.
  if (nextState === "settled" && isFetching > 0 && prevFetchingRef.current === 0) {
    // A new fetch started after this row settled — this is the one that will
    // carry the new data.
    nextState = "fetching";
  }
  if (nextState === "fetching" && isFetching === 0 && prevFetchingRef.current > 0) {
    // The post-settle fetch completed — data is fresh, clear pending.
    nextState = "idle";
  }
  prevFetchingRef.current = isFetching;

  stateRef.current = nextState;
  const isPending = nextState !== "idle";

  if (value == null) return <span className="text-[#A69DC0]">—</span>;
  return (
    <span className={["transition-all", isPending ? "opacity-50 italic" : ""].join(" ")}>
      {formatCellValue(value, "money")}
    </span>
  );
}

const SUB_COLS = [
  { id: "newBusinessTarget", label: "New Biz",   accessor: "newBusinessTarget"},
  { id: "renewalTarget",     label: "Renewal",   accessor: "renewalTarget"   },
  { id: "expansionTarget",   label: "Expansion", accessor: "expansionTarget" },
  { id: "winbackTarget",     label: "Win Back",  accessor: "winbackTarget"   },
] as const;

// Derived from SUB_COLS so there's a single source of truth for the four IDs.
const SUB_TARGET_IDS = new Set<string>(SUB_COLS.map((c) => c.id));

// The id of the first target sub-column — it owns the collapse chevron when the
// breakdown is expanded. Derived so reordering SUB_COLS moves the chevron too.
const FIRST_SUB_COL = SUB_COLS[0];

// Target sub-columns are fixed-width and not user-resizable.
const SUB_COL_WIDTH = 110;

// Width used by the trailing auto-spacer's neighbours when no explicit width is
// stored on the layout. Keyed loosely by column id then format so the table
// reads sensibly before any manual resize. `table-layout: fixed` makes these
// authoritative, so over-long content truncates instead of stretching.
function defaultColWidth(col: ColumnDef): number {
  if (col.id === "name") return 240;
  if (col.id === "state") return 90;
  switch (col.format) {
    case "pill":
      return 130;
    case "money":
    case "number":
      return 110;
    case "date":
      return 120;
    default:
      return 140;
  }
}

// Resolve the rendered width for a column: explicit layout width wins, then the
// fixed sub-column width, then the per-column default.
function resolveColWidth(
  source: SavedListSource,
  colId: string,
  layoutColumns: GridViewLayout["columns"],
): number {
  const explicit = layoutColumns.find((c) => c.id === colId)?.width;
  if (explicit != null) return explicit;
  if (SUB_TARGET_IDS.has(colId)) return SUB_COL_WIDTH;
  const def = SOURCE_COLUMNS[source].find((c) => c.id === colId);
  return def ? defaultColWidth(def) : 140;
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
  const [pageSize, setPageSize] = useState<PageSize>(DEFAULT_PAGE_SIZE);

  // Live column widths during a drag are applied imperatively to the <col>
  // elements (no per-move React re-render). Keyed by column id. The committed
  // width is persisted to layout on pointer-up via onWidthChange. The table
  // width is bumped in lockstep so a widening drag scrolls instead of being
  // capped by the committed total.
  const colRefs = useRef<Map<string, HTMLTableColElement | null>>(new Map());
  const tableRef = useRef<HTMLTableElement>(null);
  const [targetExpanded, setTargetExpanded] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [selection, setSelection] = useState<SelectionState>({ mode: "none" });

  // When the grid lives inside a plan, forward the planId so virtual fields
  // like `has_target` can compile their EXISTS subquery on the backend.
  const planId = parentKind === "plan" ? parentId ?? null : null;
  const showRowActions = parentKind === "plan" && source === "districts" && planId != null;
  const [showAddModal, setShowAddModal] = useState(false);

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
    String(pageSize),
  ].join("|");
  const [prevQuerySig, setPrevQuerySig] = useState(querySig);
  let effectivePage = page;
  if (prevQuerySig !== querySig) {
    setPrevQuerySig(querySig);
    setPage(1);
    effectivePage = 1;
    setSelection({ mode: "none" });
  }

  // Reset explicit selection when the user navigates to a different page.
  // (all-filtered stays valid across pages since it's server-resolved.)
  const [prevPageForSel, setPrevPageForSel] = useState(effectivePage);
  if (prevPageForSel !== effectivePage) {
    setPrevPageForSel(effectivePage);
    if (selection.mode === "explicit") {
      setSelection({ mode: "none" });
    }
  }

  // One fixed-size window per fetch (offset paging), so we never exceed the
  // backend's 1000-row LIMIT cap and every page is reachable.
  const limit = pageSize;
  const offset = (effectivePage - 1) * pageSize;
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

  const tanCols: TanColumnDef<Record<string, unknown>>[] = useMemo(() => {
    return visibleCols.flatMap((c) => {
      if (c.id === "target") {
        if (!targetExpanded) {
          // Collapsed: single read-only sum column — dims while any target
          // mutation for this row is in-flight.
          return [{
            id: "target",
            header: c.header,
            accessorKey: c.accessor,
            cell: (info) => {
              const row = info.row.original as Record<string, unknown>;
              const leaid = typeof row.leaid === "string" ? row.leaid : null;
              return <TargetSumCell value={info.getValue()} leaid={leaid} />;
            },
          }];
        }
        // Expanded: 4 inline-editable sub-columns
        return SUB_COLS.map((sub) => ({
          id: sub.id,
          header: sub.label,
          accessorKey: sub.accessor,
          cell: (info: { row: { original: Record<string, unknown> } }) => {
            const row = info.row.original as Record<string, unknown>;
            const leaid = typeof row.leaid === "string" ? row.leaid : null;
            if (!planId || !leaid) return <span className="text-[#A69DC0]">—</span>;
            return (
              <TargetSubCell
                planId={planId}
                leaid={leaid}
                field={sub.id as TargetField}
                value={typeof row[sub.accessor] === "number" ? row[sub.accessor] as number : null}
              />
            );
          },
        }));
      }

      return [{
        id: c.id,
        header: c.header,
        accessorKey: c.accessor,
        cell: (info: { getValue: () => unknown; row: { original: Record<string, unknown> } }) => {
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
              <span className="flex items-center gap-2 overflow-hidden">
                <RowActionsMenu
                  planId={planId!}
                  leaid={leaid}
                  districtName={typeof v === "string" ? v : String(row.name ?? "")}
                />
                <span className="truncate" title={typeof v === "string" ? v : undefined}>
                  {formatCellValue(v, c.format)}
                </span>
              </span>
            );
          }
          if (v == null) return <span className="text-[#A69DC0]">—</span>;
          // Frozen name column truncates with an ellipsis; surface the full
          // name on hover so nothing is lost.
          if (c.id === "name") {
            return (
              <span className="block truncate" title={typeof v === "string" ? v : undefined}>
                {formatCellValue(v, c.format)}
              </span>
            );
          }
          return <span>{formatCellValue(v, c.format)}</span>;
        },
      }];
    });
  }, [visibleCols, planId, targetExpanded]);

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

  /** Toggle a single row's leaid in the selection. */
  function toggleRowLeaid(leaid: string) {
    setSelection((prev) => {
      if (prev.mode === "all-filtered") {
        // all-filtered: clicking a row is a no-op — user must Clear first.
        return prev;
      }
      const next = new Set(prev.mode === "explicit" ? prev.leaids : []);
      if (!next.has(leaid) && next.size >= BULK_SELECT_CAP) {
        // Hard cap reached — do not add more rows.
        return prev;
      }
      if (next.has(leaid)) {
        next.delete(leaid);
      } else {
        next.add(leaid);
      }
      return next.size === 0 ? { mode: "none" } : { mode: "explicit", leaids: next };
    });
  }

  function renderCheckboxCell(row: { original: Record<string, unknown> }) {
    if (!showRowActions) return null;
    const leaid = typeof row.original.leaid === "string" ? row.original.leaid : null;
    const name = typeof row.original.name === "string" ? row.original.name : "district";
    const checked =
      selection.mode === "all-filtered" ||
      (selection.mode === "explicit" &&
        leaid != null &&
        selection.leaids.has(leaid));
    const atCap =
      selection.mode === "explicit" &&
      selection.leaids.size >= BULK_SELECT_CAP;
    const lockedOut = atCap && !checked;
    return (
      <td
        style={{ position: "sticky", left: 0, zIndex: 2 }}
        className="py-2.5 px-2.5 border-b border-[#EFEDF5] bg-[#FFFCFA] group-hover:bg-[#F7F5FA]"
        onClick={(e) => {
          e.stopPropagation();
          if (leaid && !lockedOut) toggleRowLeaid(leaid);
        }}
      >
        <input
          type="checkbox"
          aria-label={`Select ${name}`}
          className={`h-3.5 w-3.5 rounded accent-[#403770] ${lockedOut ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
          readOnly
          checked={checked}
          disabled={lockedOut}
        />
      </td>
    );
  }

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

  const colCount = tanCols.length + 1 + (showRowActions ? 1 : 0);

  // Left offset for the frozen district-name column: it sits after the 36px
  // checkbox column when present, otherwise flush against the left edge.
  const frozenNameLeft = showRowActions ? 36 : 0;

  // Sum of all visible column widths (+ checkbox). Drives the explicit table
  // width so columns keep their `table-layout: fixed` widths: when this is
  // narrower than the viewport, `min-width: 100%` stretches the table and the
  // trailing auto <col> absorbs the slack; when wider, the table overflows and
  // the scroll container scrolls horizontally. (Using `width: max-content`
  // here instead lets columns grow to their content, which silently breaks
  // shrinking a column below its text — verified in-browser.)
  const headerColumns = table.getHeaderGroups()[0]?.headers ?? [];
  const totalColWidth =
    (showRowActions ? 36 : 0) +
    headerColumns.reduce(
      (sum, h) => sum + resolveColWidth(source, h.column.id, layout.columns),
      0,
    );

  // One data row. Used by both the flat and grouped body renderers so the
  // sticky/frozen name cell, truncation, and hover styling stay in one place.
  function renderDataRow(row: TanRow<Record<string, unknown>>) {
    return (
      <tr
        key={row.id}
        className="group hover:bg-[#F7F5FA] transition-colors duration-100"
      >
        {renderCheckboxCell(row)}
        {row.getVisibleCells().map((cell) => {
          const isName = cell.column.id === "name";
          const tdStyle: CSSProperties | undefined = isName
            ? { position: "sticky", left: frozenNameLeft, zIndex: 2 }
            : undefined;
          return (
            <td
              key={cell.id}
              style={tdStyle}
              className={[
                "py-2.5 px-3.5 border-b border-[#EFEDF5] whitespace-nowrap overflow-hidden text-ellipsis",
                isName ? "bg-[#FFFCFA] group-hover:bg-[#F7F5FA] border-r border-[#EFEDF5]" : "",
              ].join(" ")}
            >
              {flexRender(cell.column.columnDef.cell, cell.getContext())}
            </td>
          );
        })}
        {/* Matching spacer cell — keeps the column count consistent so the
            spacer header has a body counterpart. */}
        <td aria-hidden className="border-b border-[#EFEDF5]" />
      </tr>
    );
  }

  function renderBody() {
    const tableRows = table.getRowModel().rows;

    if (!groupColumn) {
      return tableRows.map((row) => renderDataRow(row));
    }

    // Collect rows into group buckets using a Map so non-adjacent rows with
    // the same key (which can happen when Postgres picks a merge-join plan
    // that interleaves group values) land in the same bucket. Buckets are
    // emitted in first-seen key order, which preserves the server's primary
    // sort ordering across groups. Null group is captured separately and
    // re-emitted at the end under "— No value —".
    type Bucket = {
      key: string;
      rows: { row: (typeof tableRows)[number] }[];
    };
    const ordered: Bucket[] = [];
    let nullBucket: Bucket | null = null;
    const byKey = new Map<string, Bucket>();

    for (const row of tableRows) {
      const original = row.original as Record<string, unknown>;
      const key = groupKeyFor(original);
      const entry = { row };

      if (key === "__nogroup__") {
        if (!nullBucket) nullBucket = { key, rows: [] };
        nullBucket.rows.push(entry);
        continue;
      }

      let bucket = byKey.get(key);
      if (!bucket) {
        bucket = { key, rows: [] };
        byKey.set(key, bucket);
        ordered.push(bucket);
      }
      bucket.rows.push(entry);
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
        nodes.push(renderDataRow(row));
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
        <div className="shrink-0 flex items-center gap-1 px-2 py-2">
          {showRowActions && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#D4CFE2] bg-white px-2.5 py-1 text-[12px] font-medium text-[#403770] transition-colors hover:border-[#403770] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add districts
            </button>
          )}
          <GridColumnMenu
            source={source}
            layout={layout}
            onChange={setLayout}
          />
        </div>
      </div>
      {/* Selection bar — shown when rows are selected in plan/districts context */}
      {showRowActions && selection.mode !== "none" && (
        <div
          className={`shrink-0 flex items-center gap-2 px-3 py-2 text-[12px] border-b ${
            selection.mode === "all-filtered"
              ? "bg-[#403770] border-[#322a5a] text-white"
              : "bg-[#EFEDF5] border-[#D4CFE2] text-[#403770]"
          }`}
        >
          {selection.mode === "all-filtered" ? (
            <>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
              </svg>
              <span className="font-semibold whitespace-nowrap">
                All {selection.total} filtered districts selected
              </span>
              <button
                type="button"
                onClick={() => setSelection({ mode: "none" })}
                className="ml-auto text-white/70 hover:text-white transition-colors whitespace-nowrap"
                aria-label="Clear selection"
              >
                ✕ Clear
              </button>
            </>
          ) : (
            <>
              <span className="font-semibold whitespace-nowrap">
                {selection.leaids.size >= BULK_SELECT_CAP
                  ? `${BULK_SELECT_CAP} (max) selected`
                  : `${selection.leaids.size} of ${rows.length} on this page selected`}
              </span>
              {/* Show "Select all N" promote link only when all page rows checked,
                  more exist beyond the page, AND total is within the cap. */}
              {rows.every(
                (r) => typeof r.leaid === "string" && selection.leaids.has(r.leaid)
              ) && total > rows.length && total <= BULK_SELECT_CAP && (
                <>
                  <span className="text-[#A69DC0]">·</span>
                  <button
                    type="button"
                    onClick={() => setSelection({ mode: "all-filtered", total })}
                    className="font-semibold text-[#403770] underline underline-offset-2 whitespace-nowrap"
                  >
                    Select all {total}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setSelection({ mode: "none" })}
                className="ml-2 text-[#A69DC0] hover:text-[#403770] transition-colors"
                aria-label="Clear selection"
              >
                ✕
              </button>
            </>
          )}

          {/* Bulk Actions button — right-aligned */}
          <div className={selection.mode === "all-filtered" ? "ml-0" : "ml-auto"}>
            <BulkActionsMenu
              planId={planId!}
              selection={selection as Exclude<SelectionState, { mode: "none" }>}
              layout={layout}
              onSelectionCleared={() => setSelection({ mode: "none" })}
            />
          </div>
        </div>
      )}
      {truncated && <TruncatedBanner />}
      {/* Single scroll context for the whole table — both axes. The thead's
          `sticky top-0` keeps headers pinned while the body scrolls
          vertically; horizontal scroll moves header and body together so
          columns stay aligned. */}
      <div className="flex-1 min-h-0 overflow-auto">
        {/* `table-layout: fixed` makes <colgroup> widths authoritative so
            columns resize predictably (grow AND shrink); content past a
            column's width truncates. An explicit px `width` (sum of the column
            widths) lets the table grow wider than the viewport for horizontal
            scroll, while `min-width: 100%` keeps it filling a narrow viewport —
            the trailing auto <col> then absorbs the slack so real columns keep
            their set widths. */}
        <table
          ref={tableRef}
          className="border-collapse text-[13px]"
          style={{ tableLayout: "fixed", width: totalColWidth, minWidth: "100%" }}
        >
          <colgroup>
            {showRowActions && <col style={{ width: 36 }} />}
            {table.getHeaderGroups()[0].headers.map((h) => {
              const colId = h.column.id;
              return (
                <col
                  key={colId}
                  ref={(el) => {
                    colRefs.current.set(colId, el);
                  }}
                  style={{ width: `${resolveColWidth(source, colId, layout.columns)}px` }}
                />
              );
            })}
            {/* Trailing auto spacer column — absorbs leftover width. */}
            <col />
          </colgroup>
          {/* `sticky` on `<thead>` keeps both the group row and the column
              header row pinned together when the body scrolls vertically. */}
          <thead className="sticky top-0 z-[1]">
            {hasGroups && (
              <tr className="bg-[#F7F5FA]">
                {showRowActions && (
                  <th
                    aria-hidden
                    style={{ position: "sticky", left: 0, zIndex: 3, width: 36 }}
                    className="py-1.5 border-b border-[#EFEDF5] bg-[#F7F5FA]"
                  />
                )}
                {/* Frozen name cell — pinned so the group row's left edge stays
                    aligned with the frozen name column below it. */}
                <th
                  aria-hidden
                  style={{ position: "sticky", left: frozenNameLeft, zIndex: 3 }}
                  className="py-1.5 border-b border-r border-[#EFEDF5] bg-[#F7F5FA]"
                />
                {/* First (ungrouped) span loses one column to the frozen name
                    cell split out above; spans that empty out are dropped. */}
                {groupSpans
                  .map((span, i) => (i === 0 ? { ...span, count: span.count - 1 } : span))
                  .filter((span) => span.count > 0)
                  .map((span, i) =>
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
              {showRowActions && rows.length > 0 && (
                <th
                  style={{ position: "sticky", left: 0, zIndex: 3, width: 36 }}
                  className="py-2.5 px-2.5 border-b border-[#D4CFE2] bg-[#F7F5FA]"
                >
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    className="h-3.5 w-3.5 rounded accent-[#403770] cursor-pointer"
                    checked={
                      selection.mode === "all-filtered" ||
                      (selection.mode === "explicit" &&
                        rows.every(
                          (r) => typeof r.leaid === "string" && selection.leaids.has(r.leaid)
                        ))
                    }
                    ref={(el) => {
                      if (el) {
                        el.indeterminate =
                          selection.mode === "explicit" &&
                          selection.leaids.size > 0 &&
                          !rows.every(
                            (r) => typeof r.leaid === "string" && selection.leaids.has(r.leaid)
                          );
                      }
                    }}
                    onChange={(e) => {
                      if (selection.mode === "all-filtered") {
                        // Exit all-filtered when header checkbox is unchecked
                        setSelection({ mode: "none" });
                        return;
                      }
                      if (e.target.checked) {
                        const currentLeaids =
                          selection.mode === "explicit" ? selection.leaids : new Set<string>();
                        const remainingCap = BULK_SELECT_CAP - currentLeaids.size;
                        const pageLeaids = new Set([
                          ...currentLeaids,
                          ...rows
                            .map((r) => r.leaid)
                            .filter((l): l is string => typeof l === "string")
                            .slice(0, Math.max(0, remainingCap)),
                        ]);
                        setSelection({ mode: "explicit", leaids: pageLeaids });
                      } else {
                        setSelection({ mode: "none" });
                      }
                    }}
                  />
                </th>
              )}
              {table.getHeaderGroups()[0].headers.map((h) => {
                const colDef = SOURCE_COLUMNS[source].find((c) => c.id === h.column.id);
                const sortIndexInStack = layout.sort.findIndex((s) => s.id === h.column.id);
                const sortEntry = sortIndexInStack >= 0 ? layout.sort[sortIndexInStack] : undefined;
                const sortDir = sortEntry?.dir ?? null;
                const showIndex = layout.sort.length > 1 && sortIndexInStack >= 0;
                const colId = h.column.id;
                const resolvedWidth = resolveColWidth(source, colId, layout.columns);
                const isName = colId === "name";
                // Name stays `sticky` (frozen left); others stay `relative` so
                // the absolutely-positioned resize handle anchors to the cell.
                const thStyle: CSSProperties = isName
                  ? { position: "sticky", left: frozenNameLeft, zIndex: 3 }
                  : { position: "relative" };
                return (
                  <th
                    key={h.id}
                    style={thStyle}
                    className={[
                      "text-[10px] font-semibold uppercase tracking-[0.06em] py-2.5 px-3.5 border-b border-[#D4CFE2] whitespace-nowrap text-left",
                      isName
                        ? "bg-[#F7F5FA] border-r border-[#EFEDF5] text-[#8A80A8]"
                        : SUB_TARGET_IDS.has(colId)
                          ? "text-[#5B3FC8] bg-[#F3EFFE]"
                          : "text-[#8A80A8]",
                    ].join(" ")}
                  >
                    {colId === "target" ? (
                      // Collapsed target header — expand button
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Expand target breakdown"
                          onClick={() => setTargetExpanded(true)}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#EFEDF5] text-[#7C5CDB] hover:bg-[#DDD5F5] transition-colors"
                        >
                          <ChevronRight className="h-3 w-3" aria-hidden />
                        </button>
                        <span className="whitespace-nowrap">Target</span>
                      </div>
                    ) : colId === FIRST_SUB_COL.id ? (
                      // First sub-column header — collapse button
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          aria-label="Collapse target breakdown"
                          onClick={() => setTargetExpanded(false)}
                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[#EFEDF5] text-[#7C5CDB] hover:bg-[#DDD5F5] transition-colors"
                        >
                          <ChevronLeft className="h-3 w-3" aria-hidden />
                        </button>
                        <span className="whitespace-nowrap">{FIRST_SUB_COL.label}</span>
                      </div>
                    ) : SUB_TARGET_IDS.has(colId) ? (
                      // Other sub-column headers — just the label
                      <span className="whitespace-nowrap">
                        {colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}
                      </span>
                    ) : (
                      // All other columns — existing GridHeaderCell with sort + resize
                      <GridHeaderCell
                        label={colDef?.header ?? String(flexRender(h.column.columnDef.header, h.getContext()))}
                        sortable={colDef?.sortable ?? false}
                        sortDir={sortDir}
                        sortIndex={showIndex ? sortIndexInStack + 1 : undefined}
                        onSortChange={(dir, shift) => handleSortChange(h.column.id, dir, shift)}
                        width={resolvedWidth}
                        onWidthPreview={(w) => {
                          // Live feedback without a React re-render: set the
                          // matching <col> width imperatively during the drag,
                          // and adjust the table width by the same delta so a
                          // widening drag grows the scroll width immediately.
                          const el = colRefs.current.get(colId);
                          if (el) el.style.width = `${w}px`;
                          if (tableRef.current) {
                            const delta = w - resolvedWidth;
                            tableRef.current.style.width = `${totalColWidth + delta}px`;
                          }
                        }}
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
                    )}
                  </th>
                );
              })}
              {/* Spacer header — maps to the trailing auto <col>, which claims
                  any leftover horizontal space so the real (fixed-width)
                  columns keep their set widths instead of stretching. */}
              <th
                aria-hidden
                className="border-b border-[#D4CFE2] bg-[#F7F5FA]"
              />
            </tr>
          </thead>
          <tbody>
            {renderBody()}
          </tbody>
        </table>
      </div>
      {total > pageSize && (
        <GridPager
          total={total}
          page={effectivePage}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
      {showRowActions && planId && (
        <AddDistrictsModal
          planId={planId}
          open={showAddModal}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
