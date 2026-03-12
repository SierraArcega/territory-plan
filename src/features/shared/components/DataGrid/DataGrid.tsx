// src/features/shared/components/DataGrid/DataGrid.tsx
"use client";

import React, { useMemo, useState, useCallback } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef as TanStackColumnDef,
} from "@tanstack/react-table";
import type { DataGridProps, ColumnDef } from "./types";
import { renderCell } from "./renderCell";
import { SelectAllBanner } from "./SelectAllBanner";

// ---------------------------------------------------------------------------
// Sort indicator arrows
// ---------------------------------------------------------------------------

function SortArrow({ direction, active }: { direction: "asc" | "desc"; active: boolean }) {
  const color = active ? "#403770" : "#A69DC0";
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className="w-3 h-3"
      aria-hidden="true"
    >
      {direction === "asc" ? (
        <path d="M6 2.5L10 8.5H2L6 2.5Z" fill={color} />
      ) : (
        <path d="M6 9.5L2 3.5H10L6 9.5Z" fill={color} />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// DataGrid
// ---------------------------------------------------------------------------

export function DataGrid({
  data,
  columnDefs,
  entityType,
  isLoading,
  isError,
  onRetry,
  visibleColumns,
  onColumnsChange,
  sorts,
  onSort,
  hasActiveFilters,
  onClearFilters,
  pagination,
  onPageChange,
  onPageSizeChange,
  selectedIds,
  selectAllMatchingFilters,
  onToggleSelect,
  onSelectPage,
  onSelectAllMatching,
  onClearSelection,
  onRowClick,
  cellRenderers,
  columnLabel,
  rowIdAccessor,
  expandedRowIds,
  onToggleExpand,
  renderExpandedRow,
  footerSummary,
}: DataGridProps) {
  const showCheckboxes = selectedIds !== undefined;
  const showExpand = expandedRowIds !== undefined && renderExpandedRow !== undefined;
  const idKey = rowIdAccessor ?? "id";

  // ---- Column drag-to-reorder state ----
  const [dragColIdx, setDragColIdx] = useState<number | null>(null);
  const [dropColIdx, setDropColIdx] = useState<number | null>(null);

  const handleColDragStart = useCallback((idx: number) => {
    setDragColIdx(idx);
  }, []);
  const handleColDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDropColIdx(idx);
  }, []);
  const handleColDragEnd = useCallback(() => {
    setDragColIdx(null);
    setDropColIdx(null);
  }, []);
  const handleColDrop = useCallback(
    (e: React.DragEvent, targetIdx: number) => {
      e.preventDefault();
      if (dragColIdx === null || dragColIdx === targetIdx) {
        setDragColIdx(null);
        setDropColIdx(null);
        return;
      }
      const newOrder = [...visibleColumns];
      const [moved] = newOrder.splice(dragColIdx, 1);
      newOrder.splice(targetIdx, 0, moved);
      onColumnsChange(newOrder);
      setDragColIdx(null);
      setDropColIdx(null);
    },
    [dragColIdx, visibleColumns, onColumnsChange],
  );

  // ---- Row IDs for current page ----
  const pageIds = useMemo(
    () => data.map((row) => String(row[idKey])),
    [data, idKey],
  );

  const allPageSelected =
    showCheckboxes && pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = showCheckboxes && pageIds.some((id) => selectedIds.has(id));
  const showSelectAllBanner = allPageSelected && onSelectAllMatching != null;

  // ---- Resolve column label ----
  const resolveLabel = useCallback(
    (key: string): string => {
      if (columnLabel) return columnLabel(key);
      return columnDefs.find((c) => c.key === key)?.label ?? key;
    },
    [columnLabel, columnDefs],
  );

  // ---- Build TanStack columns ----
  const columns = useMemo<TanStackColumnDef<Record<string, unknown>>[]>(() => {
    const cols: TanStackColumnDef<Record<string, unknown>>[] = visibleColumns.map((key) => {
      const colDef = columnDefs.find((c) => c.key === key);
      return {
        id: key,
        accessorFn: (row: Record<string, unknown>) => row[key],
        header: () => resolveLabel(key),
        cell: (info) => {
          const value = info.getValue();
          const row = info.row.original;
          if (cellRenderers?.[key] && colDef) {
            return cellRenderers[key]({ value, row, columnDef: colDef });
          }
          return renderCell(value, key, colDef);
        },
      };
    });

    // Prepend expand column
    if (showExpand) {
      cols.unshift({
        id: "__expand",
        header: () => null,
        cell: () => null,
        size: 36,
      });
    }

    // Prepend checkbox column
    if (showCheckboxes) {
      cols.unshift({
        id: "__select",
        header: () => null,
        cell: () => null,
        size: 40,
      });
    }

    return cols;
  }, [visibleColumns, columnDefs, showCheckboxes, showExpand, cellRenderers, resolveLabel]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  // ---- Pagination math ----
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 50;
  const total = pagination?.total ?? 0;
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const primaryColumn = visibleColumns[0];
  const totalColCount = columns.length;

  return (
    <div className="flex flex-col gap-2">
      <style>{`
        @keyframes datagrid-progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
      {/* Card wrapper */}
      <div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm">
        {/* Refresh loading progress bar */}
        {isLoading && data.length > 0 && (
          <div className="relative h-0.5 overflow-hidden">
            <div
              className="absolute inset-0 bg-[#403770]"
              style={{ animation: "datagrid-progress 1.4s ease-in-out infinite" }}
            />
          </div>
        )}
        {/* Scrollable table area */}
        <div className="overflow-auto">
          <table
            role="grid"
            aria-rowcount={pagination?.total ?? data.length}
            aria-colcount={columnDefs.length}
            className="min-w-full"
          >
            {/* ---- Header ---- */}
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="border-b border-[#E2DEEC]">
                  {headerGroup.headers.map((header) => {
                    const colKey = header.column.id;

                    // Expand header (spacer)
                    if (colKey === "__expand") {
                      return (
                        <th
                          key={header.id}
                          className="w-9 bg-[#F7F5FA] sticky top-0 z-10"
                        />
                      );
                    }

                    // Checkbox header
                    if (colKey === "__select") {
                      return (
                        <th
                          key={header.id}
                          className="w-12 pl-4 pr-2 py-3 bg-[#F7F5FA] sticky top-0 z-10"
                        >
                          <input
                            type="checkbox"
                            aria-label="Select all rows on this page"
                            checked={allPageSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = somePageSelected && !allPageSelected;
                            }}
                            onChange={() => {
                              if (allPageSelected) {
                                onClearSelection?.();
                              } else {
                                onSelectPage?.(pageIds);
                              }
                            }}
                            className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                          />
                        </th>
                      );
                    }

                    // Data column header
                    const sortRule = sorts.find((s) => s.column === colKey);
                    const colDef = columnDefs.find((c) => c.key === colKey);
                    const isSortable = colDef?.sortable !== false;
                    const dataColIdx = visibleColumns.indexOf(colKey);
                    const isDragging = dragColIdx === dataColIdx;
                    const isDropTarget =
                      dropColIdx === dataColIdx && dragColIdx !== null && dragColIdx !== dataColIdx;

                    let ariaSortValue: "ascending" | "descending" | "none" | undefined;
                    if (isSortable) {
                      if (sortRule?.direction === "asc") ariaSortValue = "ascending";
                      else if (sortRule?.direction === "desc") ariaSortValue = "descending";
                      else ariaSortValue = "none";
                    }

                    return (
                      <th
                        key={header.id}
                        aria-sort={ariaSortValue}
                        draggable
                        onDragStart={() => handleColDragStart(dataColIdx)}
                        onDragOver={(e) => handleColDragOver(e, dataColIdx)}
                        onDragEnd={handleColDragEnd}
                        onDrop={(e) => handleColDrop(e, dataColIdx)}
                        className={`px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider whitespace-nowrap bg-[#F7F5FA] sticky top-0 z-10 select-none transition-colors duration-100 ${
                          isSortable
                            ? "cursor-pointer hover:text-[#403770]"
                            : ""
                        } cursor-grab active:cursor-grabbing ${
                          isDragging ? "opacity-40" : ""
                        } ${isDropTarget ? "border-l-2 border-l-[#403770]" : ""}`}
                        onClick={(e) => {
                          if (isSortable) onSort(colKey, e.shiftKey);
                        }}
                      >
                        <span className="inline-flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {isSortable && (
                            <span className="inline-flex flex-col">
                              <SortArrow
                                direction="asc"
                                active={sortRule?.direction === "asc"}
                              />
                              <SortArrow
                                direction="desc"
                                active={sortRule?.direction === "desc"}
                              />
                            </span>
                          )}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            {/* ---- Body ---- */}
            <tbody className={isLoading && data.length > 0 ? "opacity-50 transition-opacity" : ""}>
              {/* Select-all escalation banner */}
              {showSelectAllBanner && (
                <tr>
                  <td colSpan={totalColCount} className="p-0">
                    <SelectAllBanner
                      pageRowCount={pageIds.length}
                      totalMatching={pagination?.total ?? data.length}
                      selectAllMatchingFilters={selectAllMatchingFilters ?? false}
                      onSelectAllMatching={onSelectAllMatching!}
                      onClearSelection={onClearSelection ?? (() => {})}
                    />
                  </td>
                </tr>
              )}

              {/* Loading skeleton — initial load only (no data yet) */}
              {isLoading && data.length === 0 &&
                Array.from({ length: 5 }).map((_, rowIdx) => (
                  <tr
                    key={`skel-${rowIdx}`}
                    className={rowIdx < 4 ? "border-b border-[#E2DEEC]" : ""}
                  >
                    {showCheckboxes && (
                      <td className="w-12 pl-4 pr-2 py-3">
                        <div className="h-4 w-4 bg-[#E2DEEC] rounded animate-pulse" />
                      </td>
                    )}
                    {showExpand && (
                      <td className="w-9 px-2 py-3">
                        <div className="h-4 w-4 bg-[#E2DEEC] rounded animate-pulse" />
                      </td>
                    )}
                    {visibleColumns.map((col, colIdx) => {
                      const widths = ["60%", "30%", "40%"];
                      const w = widths[(colIdx + rowIdx) % widths.length];
                      return (
                        <td key={col} className="px-4 py-3">
                          <div
                            className="h-4 bg-[#E2DEEC]/60 rounded animate-pulse"
                            style={{ width: w }}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}

              {/* Error state */}
              {!isLoading && isError && (
                <tr>
                  <td colSpan={totalColCount} className="py-16">
                    <div role="status" className="flex flex-col items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 mb-4 text-[#F37167]"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      <span className="text-sm font-semibold text-[#544A78] mb-2">
                        Something went wrong
                      </span>
                      <span className="text-xs text-[#8A80A8] mb-3">
                        Failed to load {entityType}
                      </span>
                      {onRetry && (
                        <button
                          onClick={onRetry}
                          className="text-sm text-[#403770] underline hover:no-underline"
                        >
                          Try again
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state — filtered (has active filters) */}
              {!isLoading && !isError && data.length === 0 && hasActiveFilters && (
                <tr>
                  <td colSpan={totalColCount} className="py-16">
                    <div role="status" className="flex flex-col items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 mb-4 text-[#A69DC0]"
                      >
                        <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
                      </svg>
                      <span className="text-sm font-semibold text-[#544A78] mb-2">
                        No matching results
                      </span>
                      <span className="text-xs text-[#8A80A8] mb-3">
                        Try adjusting your filters or search term
                      </span>
                      {onClearFilters && (
                        <button
                          onClick={onClearFilters}
                          className="text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg px-3 py-1.5 hover:bg-[#EFEDF5] transition-colors mt-3"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Empty state — no data at all */}
              {!isLoading && !isError && data.length === 0 && !hasActiveFilters && (
                <tr>
                  <td colSpan={totalColCount} className="py-16">
                    <div role="status" className="flex flex-col items-center justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-10 h-10 mb-4 text-[#A69DC0]"
                      >
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                      </svg>
                      <span className="text-sm font-semibold text-[#544A78] mb-2">
                        No {entityType} yet
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {/* Data rows — shown when not loading, or when refreshing with existing data */}
              {(!isLoading || (isLoading && data.length > 0)) &&
                !isError &&
                table.getRowModel().rows.map((row, rowIdx) => {
                  const isLast = rowIdx === table.getRowModel().rows.length - 1;
                  const rowId = String(row.original[idKey]);
                  const isSelected = showCheckboxes && selectedIds.has(rowId);
                  const isExpanded = expandedRowIds?.has(rowId) ?? false;

                  return (
                    <React.Fragment key={row.id}>
                      <tr
                        className={`group transition-colors duration-100 ${
                          !isLast ? "border-b border-[#E2DEEC]" : ""
                        } ${
                          isSelected
                            ? "bg-[#C4E7E6]/15"
                            : "hover:bg-[#EFEDF5]"
                        } ${onRowClick ? "cursor-pointer" : ""}`}
                        onClick={() => onRowClick?.(row.original)}
                      >
                        {row.getVisibleCells().map((cell) => {
                          // Checkbox cell
                          if (cell.column.id === "__select") {
                            return (
                              <td key={cell.id} className="w-12 pl-4 pr-2 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    onToggleSelect?.(rowId);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-4 h-4 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                                />
                              </td>
                            );
                          }

                          // Expand chevron cell
                          if (cell.column.id === "__expand") {
                            return (
                              <td key={cell.id} className="w-9 px-2 py-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleExpand?.(rowId);
                                  }}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#EFEDF5] transition-colors"
                                  aria-label={isExpanded ? "Collapse row" : "Expand row"}
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className={`transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  >
                                    <path d="M6 4L10 8L6 12" />
                                  </svg>
                                </button>
                              </td>
                            );
                          }

                          const isPrimary = cell.column.id === primaryColumn;
                          return (
                            <td
                              key={cell.id}
                              className={`px-4 py-3 whitespace-nowrap max-w-[240px] truncate ${
                                isPrimary
                                  ? "text-sm font-medium text-[#403770]"
                                  : "text-sm text-[#6E6390]"
                              }`}
                            >
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          );
                        })}
                      </tr>

                      {/* Expanded row content */}
                      {showExpand && isExpanded && (
                        <tr className="bg-[#F7F5FA]">
                          <td colSpan={totalColCount} className="px-0 py-0">
                            {renderExpandedRow(row.original)}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Footer summary bar */}
        <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA] flex items-center justify-between">
          <span
            className="text-[12px] font-medium text-[#8A80A8] tracking-wide"
            aria-live="polite"
          >
            {total === 0
              ? `No ${entityType}`
              : `Showing ${startRow.toLocaleString()}\u2013${endRow.toLocaleString()} of ${total.toLocaleString()} ${entityType}`}
          </span>
          {footerSummary && <div>{footerSummary}</div>}
        </div>
      </div>

      {/* Pagination (below the card) */}
      {pagination && (
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#D4CFE2] text-[#6E6390] hover:text-[#403770] hover:border-[#8A80A8] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-[12px] text-[#8A80A8] font-medium tabular-nums">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#D4CFE2] text-[#6E6390] hover:text-[#403770] hover:border-[#8A80A8] hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>

          {onPageSizeChange && (
            <div className="flex items-center gap-2">
              <label
                htmlFor="datagrid-page-size"
                className="text-[12px] text-[#8A80A8] font-medium"
              >
                Rows per page
              </label>
              <select
                id="datagrid-page-size"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                className="text-[12px] border border-[#D4CFE2] rounded-md px-2 py-1 text-[#6E6390] focus:ring-[#403770]/30 focus:border-[#403770]"
              >
                {[25, 50, 100, 200].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
