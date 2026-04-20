"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, ChevronDown, Sparkles } from "lucide-react";
import { DataGrid } from "@/features/shared/components/DataGrid";
import type {
  ColumnDef,
  CellRendererFn,
  SortRule,
} from "@/features/shared/components/DataGrid/types";
import { formatCurrency } from "@/features/shared/lib/format";
import { useIncreaseTargetsList } from "../lib/queries";
import type { IncreaseTarget } from "../lib/types";
import { increaseTargetsColumns } from "../lib/columns/increaseTargetsColumns";
import AddToPlanPopover from "./AddToPlanPopover";

const TOAST_DURATION_MS = 3000;

// Row shape stored in the DataGrid. We flatten lastClosedWon onto a
// derived `lastRepName` key so the column renderer can auto-display it.
type IncreaseTargetRow = IncreaseTarget & {
  lastRepName: string | null;
  lastSaleSummary: string | null;
  products: string[];
};

function formatShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildLastSaleSummary(row: IncreaseTarget): string | null {
  const lcw = row.lastClosedWon;
  if (!lcw) return null;
  const amountPart = lcw.amount != null ? formatCurrency(lcw.amount, true) : null;
  const datePart = formatShortDate(lcw.closeDate);
  const parts = [amountPart, datePart].filter(Boolean);
  return parts.length ? parts.join(" \u00B7 ") : null;
}

function toRow(r: IncreaseTarget): IncreaseTargetRow {
  return {
    ...r,
    lastRepName: r.lastClosedWon?.repName ?? null,
    lastSaleSummary: buildLastSaleSummary(r),
    products: r.productTypes,
  };
}

// ---------------------------------------------------------------------------
// Cell renderers
// ---------------------------------------------------------------------------

const StateCell: CellRendererFn = ({ value }) => {
  if (typeof value !== "string" || value.length === 0) {
    return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold text-[#544A78] bg-[#EFEDF5] border border-[#D4CFE2]">
      {value}
    </span>
  );
};

const LastSaleCell: CellRendererFn = ({ value }) => {
  if (typeof value !== "string" || !value) {
    return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  }
  return <span className="text-sm text-[#6E6390]">{value}</span>;
};

const ProductsCell: CellRendererFn = ({ value }) => {
  if (!Array.isArray(value) || value.length === 0) {
    return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  }
  const items = value as string[];
  const shown = items.slice(0, 2);
  const overflow = items.length - shown.length;
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {shown.map((p) => (
        <span
          key={p}
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-[#403770] bg-[#EFEDF5] border border-[#D4CFE2]"
        >
          {p}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium text-[#6E6390] bg-[#F7F5FA] border border-[#D4CFE2]"
          aria-label={`Show ${overflow} more products`}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Expanded row detail
// ---------------------------------------------------------------------------

function ExpandedRowDetail({ row }: { row: IncreaseTargetRow }) {
  const lcw = row.lastClosedWon;
  return (
    <div className="px-6 py-4 bg-[#F7F5FA] border-t border-b border-[#E2DEEC] space-y-3">
      {/* Products */}
      <div>
        <div className="text-[11px] font-semibold text-[#544A78] uppercase tracking-wider mb-1.5">
          Products purchased
        </div>
        <div className="flex flex-wrap gap-1.5">
          {row.productTypes.length === 0 ? (
            <span className="text-xs text-[#A69DC0]">No product history</span>
          ) : (
            row.productTypes.map((p) => (
              <span
                key={`pt-${p}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-white bg-[#403770]"
              >
                {p}
              </span>
            ))
          )}
        </div>
        {row.subProducts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {row.subProducts.map((sp) => (
              <span
                key={`sp-${sp}`}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium text-[#6E6390] bg-[#EFEDF5] border border-[#D4CFE2]"
              >
                {sp}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Last sale */}
      <div>
        <div className="text-[11px] font-semibold text-[#544A78] uppercase tracking-wider mb-1">
          Last sale
        </div>
        {lcw ? (
          <div className="text-xs text-[#6E6390]">
            Closed Won {lcw.schoolYr ?? ""}
            {lcw.amount != null ? ` \u00B7 ${formatCurrency(lcw.amount)}` : ""}
            {lcw.closeDate ? ` \u00B7 ${formatShortDate(lcw.closeDate)}` : ""}
            {lcw.repName ? ` \u00B7 ${lcw.repName}` : ""}
          </div>
        ) : (
          <div className="text-xs text-[#A69DC0]">No closed-won opportunity on file.</div>
        )}
      </div>

      {/* FY26 breakdown */}
      <div>
        <div className="text-[11px] font-semibold text-[#544A78] uppercase tracking-wider mb-1">
          FY26 revenue breakdown
        </div>
        <div className="text-xs text-[#6E6390]">
          Completed {formatCurrency(row.fy26CompletedRevenue)}
          {" \u00B7 "}
          Scheduled {formatCurrency(row.fy26ScheduledRevenue)}
          {row.fy26SessionCount != null && (
            <>
              {" \u00B7 "}
              {row.fy26SessionCount.toLocaleString()} sessions
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add button (renders inline + anchors its own popover)
// ---------------------------------------------------------------------------

interface AddButtonProps {
  row: IncreaseTargetRow;
  onSuccess: (planName: string) => void;
}

function AddButton({ row, onSuccess }: AddButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const handleSuccess = (planName: string) => {
    setIsOpen(false);
    onSuccess(planName);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        Add
        <ChevronDown className="w-3 h-3 opacity-80" />
      </button>
      {isOpen && (
        <AddToPlanPopover
          district={row}
          anchorRef={buttonRef}
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSuccess={handleSuccess}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Tab body
// ---------------------------------------------------------------------------

function compareRows(
  a: IncreaseTargetRow,
  b: IncreaseTargetRow,
  sort: SortRule,
): number {
  const dir = sort.direction === "asc" ? 1 : -1;
  const av = (a as unknown as Record<string, unknown>)[sort.column];
  const bv = (b as unknown as Record<string, unknown>)[sort.column];

  const aNil = av === null || av === undefined;
  const bNil = bv === null || bv === undefined;
  if (aNil && bNil) return 0;
  if (aNil) return 1;
  if (bNil) return -1;

  if (typeof av === "number" && typeof bv === "number") {
    return (av - bv) * dir;
  }
  return String(av).localeCompare(String(bv)) * dir;
}

export default function IncreaseTargetsTab() {
  const query = useIncreaseTargetsList();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [sorts, setSorts] = useState<SortRule[]>([
    { column: "fy26Revenue", direction: "desc" },
  ]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() =>
    increaseTargetsColumns.filter((c) => c.isDefault).map((c) => c.key),
  );
  const [toast, setToast] = useState<string | null>(null);

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [toast]);

  const rows = useMemo<IncreaseTargetRow[]>(() => {
    const raw = query.data?.districts ?? [];
    return raw.map(toRow);
  }, [query.data]);

  const sortedRows = useMemo(() => {
    if (sorts.length === 0) return rows;
    return [...rows].sort((a, b) => {
      for (const s of sorts) {
        const c = compareRows(a, b, s);
        if (c !== 0) return c;
      }
      return 0;
    });
  }, [rows, sorts]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set<string>();
      // Only one row expanded at a time per spec.
      if (!prev.has(id)) next.add(id);
      return next;
    });
  }, []);

  const handleSort = useCallback((column: string, shiftKey?: boolean) => {
    const colDef = increaseTargetsColumns.find(
      (c: ColumnDef) => c.key === column,
    );
    if (colDef?.sortable === false) return;
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (shiftKey) {
        if (existing) {
          return prev.map((s) =>
            s.column === column
              ? { ...s, direction: s.direction === "asc" ? "desc" : "asc" }
              : s,
          );
        }
        return [...prev, { column, direction: "asc" }];
      }
      if (existing) {
        if (prev.length === 1) {
          return [
            {
              column,
              direction: existing.direction === "asc" ? "desc" : "asc",
            },
          ];
        }
        return [
          {
            column,
            direction: existing.direction === "asc" ? "desc" : "asc",
          },
        ];
      }
      return [{ column, direction: "asc" }];
    });
  }, []);

  const handleAddSuccess = useCallback((planName: string) => {
    setToast(`Added to ${planName}`);
  }, []);

  const cellRenderers = useMemo<Record<string, CellRendererFn>>(
    () => ({
      state: StateCell,
      lastSaleSummary: LastSaleCell,
      products: ProductsCell,
    }),
    [],
  );

  const isLoading = query.isLoading;
  const isError = query.isError;
  const districtCount = query.data?.districts.length ?? 0;
  const revenueAtRisk = query.data?.totalRevenueAtRisk ?? 0;

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* Summary strip — sticky just under the tab bar */}
      <div
        className="flex-shrink-0 px-6 py-3 bg-[#F7F5FA] border-b border-[#E2DEEC]"
        aria-live="polite"
      >
        <div className="flex items-center gap-2 text-sm font-semibold text-[#403770]">
          <Sparkles className="w-4 h-4 text-[#F37167]" />
          <span>
            {districtCount} {districtCount === 1 ? "district" : "districts"}
            {" \u2022 "}
            {formatCurrency(revenueAtRisk, true)} FY26 revenue at renewal risk
          </span>
        </div>
        <p className="mt-0.5 text-xs text-[#6E6390]">
          FY26 Fullmind customers with no FY27 activity yet.
        </p>
      </div>

      {/* Toast / success banner */}
      {toast && (
        <div className="flex-shrink-0 mx-6 mt-3 px-3 py-2 rounded-md bg-[#EDFFE3] border border-[#8AC670] text-xs text-[#544A78]">
          {toast}
        </div>
      )}

      {/* Error banner */}
      {isError && (
        <div className="flex-shrink-0 mx-6 mt-3 px-3 py-2 rounded-md bg-[#fef1f0] border border-[#f58d85] flex items-center justify-between gap-3">
          <span className="text-xs text-[#544A78]">
            Couldn&apos;t load the list.
          </span>
          <button
            onClick={() => query.refetch()}
            className="text-xs font-semibold text-[#403770] hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 p-6 flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !isError && districtCount === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-[#6E6390] text-center max-w-sm">
              Nothing at risk right now. Every FY26 customer has FY27 activity.
            </p>
          </div>
        ) : (
          <DataGrid
            data={sortedRows as unknown as Record<string, unknown>[]}
            columnDefs={increaseTargetsColumns}
            entityType="districts"
            isLoading={false}
            isError={false}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
            sorts={sorts}
            onSort={handleSort}
            pagination={undefined}
            onPageChange={() => {}}
            rowIdAccessor="leaid"
            expandedRowIds={expandedIds}
            onToggleExpand={toggleExpand}
            onRowClick={(row) => toggleExpand(row.leaid as string)}
            renderExpandedRow={(row) => (
              <ExpandedRowDetail row={row as unknown as IncreaseTargetRow} />
            )}
            renderRowAction={(row) => (
              <AddButton
                row={row as unknown as IncreaseTargetRow}
                onSuccess={handleAddSuccess}
              />
            )}
            cellRenderers={cellRenderers}
          />
        )}
      </div>
    </div>
  );
}
