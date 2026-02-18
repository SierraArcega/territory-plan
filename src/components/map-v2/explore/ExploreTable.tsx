"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateDistrictEdits, useUsers } from "@/lib/api";
import { districtColumns } from "./columns/districtColumns";
import { activityColumns } from "./columns/activityColumns";
import { taskColumns } from "./columns/taskColumns";
import { contactColumns } from "./columns/contactColumns";

// ---- Types ----

interface Props {
  data: Record<string, unknown>[];
  visibleColumns: string[];
  sort: { column: string; direction: "asc" | "desc" } | null;
  onSort: (column: string) => void;
  onRowClick?: (row: Record<string, unknown>) => void;
  isLoading: boolean;
  pagination: { page: number; pageSize: number; total: number } | undefined;
  onPageChange: (page: number) => void;
  entityType: string;
  // Selection
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectPage?: (ids: string[]) => void;
  onClearSelection?: () => void;
}

// ---- Column label lookup ----
// Build a map from key -> label across all entity column defs.

const ALL_COLUMN_DEFS = [
  ...districtColumns,
  ...activityColumns,
  ...taskColumns,
  ...contactColumns,
];

const LABEL_MAP: Record<string, string> = {};
for (const col of ALL_COLUMN_DEFS) {
  LABEL_MAP[col.key] = col.label;
}

/**
 * Generate a readable label from a camelCase or snake_case key.
 * Prefers the pre-defined label from column defs if available.
 */
function columnLabel(key: string): string {
  if (LABEL_MAP[key]) return LABEL_MAP[key];
  // camelCase -> "Camel Case"
  const spaced = key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// ---- Cell formatting ----

const CURRENCY_KEYS = /revenue|pipeline|booking|value|take|closed_won/i;
const PERCENT_KEYS = /percent|rate|proficiency/i;

function formatCellValue(value: unknown, key: string): string {
  if (value == null) return "\u2014";

  // Booleans
  if (typeof value === "boolean") return value ? "Yes" : "No";

  // Arrays (e.g. tags: [{name: "..."}])
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "name" in item
          ? (item as { name: string }).name
          : String(item)
      )
      .join(", ");
  }

  // Dates (ISO strings)
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  // Numbers
  if (typeof value === "number") {
    if (PERCENT_KEYS.test(key)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    if (CURRENCY_KEYS.test(key)) {
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  }

  return String(value);
}

// ---- Component ----

export default function ExploreTable({
  data,
  visibleColumns,
  sort,
  onSort,
  onRowClick,
  isLoading,
  pagination,
  onPageChange,
  entityType,
  selectedIds,
  onToggleSelect,
  onSelectPage,
  onClearSelection,
}: Props) {
  const showCheckboxes = entityType === "districts" && !!selectedIds;
  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ rowId: string; column: string } | null>(null);
  const [editValue, setEditValue] = useState("");

  const queryClient = useQueryClient();
  const updateEdits = useUpdateDistrictEdits();
  const { data: users } = useUsers();

  const handleSave = (rowId: string, column: string, value?: string) => {
    const saveValue = value !== undefined ? value : editValue;

    updateEdits.mutate(
      {
        leaid: rowId,
        [column]: saveValue || undefined,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["explore"] });
        },
      }
    );

    setEditingCell(null);
  };

  // Render an owner dropdown cell
  function renderOwnerCell(value: unknown, rowId: string) {
    const isEditing = editingCell?.rowId === rowId && editingCell?.column === "owner";

    if (isEditing) {
      return (
        <select
          autoFocus
          className="w-full px-2 py-1 text-[13px] border border-[#403770]/30 rounded-md outline-none bg-white focus:ring-1 focus:ring-[#403770]/40 text-gray-700"
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value);
            handleSave(rowId, "owner", e.target.value);
          }}
          onBlur={() => setEditingCell(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setEditingCell(null);
          }}
        >
          <option value="">— Unassigned —</option>
          {(users || []).map((u: { id: string; fullName: string | null; email: string }) => (
            <option key={u.id} value={u.fullName || u.email}>
              {u.fullName || u.email}
            </option>
          ))}
        </select>
      );
    }

    return (
      <span
        className="group/cell cursor-pointer inline-flex items-center gap-1 px-1 -mx-1 py-0.5 -my-0.5 rounded border border-transparent hover:border-dashed hover:border-plum/30 hover:bg-plum/5 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          setEditingCell({ rowId, column: "owner" });
          setEditValue(String(value || ""));
        }}
      >
        {value ? (
          <span className="text-[13px] text-gray-600">{String(value)}</span>
        ) : (
          <span className="text-[13px] text-gray-300">assign owner</span>
        )}
        <svg className="shrink-0 opacity-0 group-hover/cell:opacity-50 w-3 h-3 text-[#403770]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M4 6L8 10L12 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  // Render a text input cell (for notes)
  function renderTextEditCell(value: unknown, rowId: string, column: string) {
    const isEditing = editingCell?.rowId === rowId && editingCell?.column === column;

    if (isEditing) {
      return (
        <input
          autoFocus
          className="w-full px-2 py-1 text-[13px] border border-[#403770]/30 rounded-md outline-none focus:ring-1 focus:ring-[#403770]/40 text-gray-700"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={() => handleSave(rowId, column)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave(rowId, column);
            if (e.key === "Escape") setEditingCell(null);
          }}
        />
      );
    }

    return (
      <span
        className="group/cell cursor-text inline-flex items-center gap-1 px-1 -mx-1 py-0.5 -my-0.5 rounded border border-transparent hover:border-dashed hover:border-plum/30 hover:bg-plum/5 transition-all"
        onClick={(e) => {
          e.stopPropagation();
          setEditingCell({ rowId, column });
          setEditValue(String(value || ""));
        }}
      >
        {formatCellValue(value, column) || <span className="text-[13px] text-gray-300">click to edit</span>}
        <svg className="shrink-0 opacity-0 group-hover/cell:opacity-50 w-3 h-3 text-[#403770]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M11.5 1.5L14.5 4.5L5 14H2V11L11.5 1.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  // Checkbox helpers
  const pageIds = useMemo(
    () => data.map((row) => (row.leaid || row.id) as string),
    [data]
  );
  const allPageSelected = showCheckboxes && pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = showCheckboxes && pageIds.some((id) => selectedIds.has(id));

  // Build TanStack column definitions from visible column keys
  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
    const dataCols: ColumnDef<Record<string, unknown>>[] = visibleColumns.map((key) => {
      const colDef = districtColumns.find((d) => d.key === key);
      const isEditable = entityType === "districts" && colDef?.editable;
      const isOwner = key === "owner";

      return {
        id: key,
        accessorFn: (row: Record<string, unknown>) => row[key],
        header: () => columnLabel(key),
        cell: isEditable
          ? (info) => {
              const value = info.getValue();
              const rowId = (info.row.original.leaid || info.row.original.id) as string;

              if (isOwner) {
                return renderOwnerCell(value, rowId);
              }
              return renderTextEditCell(value, rowId, key);
            }
          : (info) => formatCellValue(info.getValue(), key),
      };
    });

    if (showCheckboxes) {
      dataCols.unshift({
        id: "__select",
        header: () => null, // header checkbox rendered manually
        cell: () => null, // cell checkbox rendered manually
        size: 40,
      });
    }

    return dataCols;
  },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleColumns, entityType, editingCell, editValue, users, showCheckboxes]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
  });

  // Pagination math
  const page = pagination?.page ?? 1;
  const pageSize = pagination?.pageSize ?? 50;
  const total = pagination?.total ?? 0;
  const startRow = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, total);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // Determine if a column should show the "name" styling (primary column)
  const primaryColumn = visibleColumns[0];

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable table area */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-gray-200">
                {headerGroup.headers.map((header) => {
                  const colKey = header.column.id;

                  // Checkbox header
                  if (colKey === "__select") {
                    return (
                      <th
                        key={header.id}
                        className="w-10 px-3 py-3 bg-gray-50/80 sticky top-0 z-10"
                      >
                        <input
                          type="checkbox"
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
                          className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                        />
                      </th>
                    );
                  }

                  const isSorted = sort?.column === colKey;
                  return (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50/80 sticky top-0 z-10 cursor-pointer select-none hover:text-[#403770] transition-colors duration-100"
                      onClick={() => onSort(colKey)}
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {isSorted && (
                          <span className="text-[#403770] font-bold text-xs">
                            {sort.direction === "asc" ? "\u2191" : "\u2193"}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {/* Loading skeleton */}
            {isLoading &&
              Array.from({ length: 10 }).map((_, rowIdx) => (
                <tr key={`skel-${rowIdx}`} className={rowIdx < 9 ? "border-b border-gray-100" : ""}>
                  {showCheckboxes && (
                    <td className="w-10 px-3 py-3">
                      <div className="h-3.5 w-3.5 bg-gray-100 rounded animate-pulse" />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={col} className="px-4 py-3">
                      <div className="h-4 bg-[#C4E7E6]/20 rounded animate-pulse" style={{ width: `${55 + Math.random() * 30}%` }} />
                    </td>
                  ))}
                </tr>
              ))}

            {/* Empty state */}
            {!isLoading && data.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length + (showCheckboxes ? 1 : 0)} className="py-16">
                  <div className="flex flex-col items-center justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span className="text-lg font-medium text-gray-600 mb-2">No results found</span>
                    <span className="text-sm text-gray-500 max-w-sm text-center">Try adjusting your filters or search criteria</span>
                  </div>
                </td>
              </tr>
            )}

            {/* Data rows */}
            {!isLoading &&
              table.getRowModel().rows.map((row, rowIdx) => {
                const isLast = rowIdx === table.getRowModel().rows.length - 1;
                const rowId = (row.original.leaid || row.original.id) as string;
                const isSelected = showCheckboxes && selectedIds.has(rowId);
                return (
                  <tr
                    key={row.id}
                    className={`group cursor-pointer transition-colors duration-100 ${!isLast ? "border-b border-gray-100" : ""} ${
                      isSelected ? "bg-[#403770]/[0.04]" : "hover:bg-gray-50/70"
                    }`}
                    onClick={() => onRowClick?.(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => {
                      // Checkbox cell
                      if (cell.column.id === "__select") {
                        return (
                          <td key={cell.id} className="w-10 px-3 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                onToggleSelect?.(rowId);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                            />
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
                              : "text-[13px] text-gray-600"
                          }`}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Pagination footer */}
      <div className="bg-gray-50/60 border-t border-gray-100 px-4 py-2.5 flex items-center justify-between shrink-0">
        <span className="text-[12px] font-medium text-gray-400 tracking-wide">
          {total === 0
            ? "No results"
            : `Showing ${startRow.toLocaleString()}\u2013${endRow.toLocaleString()} of ${total.toLocaleString()}`}
        </span>

        <div className="flex items-center gap-2">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-[#403770] hover:border-gray-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-[12px] text-gray-400 font-medium tabular-nums">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-gray-200 text-gray-600 hover:text-[#403770] hover:border-gray-300 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
