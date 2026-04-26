"use client";

import { useMemo, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";

interface Props {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  truncated: boolean;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "number") {
    if (Number.isFinite(value) && Math.abs(value) > 1000) {
      return value.toLocaleString();
    }
    return String(value);
  }
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DataTable({ columns, rows, rowCount, truncated }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const tanstackColumns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      columns.map((name) => ({
        id: name,
        accessorKey: name,
        header: name.toUpperCase(),
        cell: ({ getValue }) => formatCell(getValue()),
      })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 12 } },
  });

  return (
    <div className="flex flex-col items-start w-full">
      <div className="flex items-center justify-between w-full px-8 py-4">
        <div className="flex items-center gap-2.5">
          <p className="text-xl font-bold text-[#544A78]">{rowCount.toLocaleString()}</p>
          <p className="text-sm font-medium text-[#6E6390]">rows</p>
          {truncated && (
            <span className="rounded-full bg-[#fffaf1] px-2 py-0.5 text-[10px] font-semibold text-[#a67800]">
              Truncated at 500 — add filters
            </span>
          )}
        </div>
      </div>

      <div className="mx-8 w-[calc(100%-4rem)] rounded-xl border border-[#E2DEEC] bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-[#F7F5FA] border-b border-[#E2DEEC]">
              {table.getHeaderGroups().map((hg) => (
                <tr key={hg.id}>
                  {hg.headers.map((h) => (
                    <th
                      key={h.id}
                      onClick={h.column.getToggleSortingHandler()}
                      className="h-10 px-4 text-left text-[10px] font-semibold uppercase tracking-[0.6px] text-[#8A80A8] cursor-pointer whitespace-nowrap"
                    >
                      <span className="inline-flex items-center gap-1">
                        {flexRender(h.column.columnDef.header, h.getContext())}
                        {h.column.getIsSorted() === "desc" && <span className="text-[#544A78] text-[9px]">↓</span>}
                        {h.column.getIsSorted() === "asc" && <span className="text-[#544A78] text-[9px]">↑</span>}
                      </span>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row, i) => (
                <tr
                  key={row.id}
                  className={`h-11 border-b border-[#E2DEEC] ${i % 2 === 0 ? "bg-white" : "bg-[#F7F5FA]"}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-4 text-[13px] font-medium text-[#544A78] whitespace-nowrap"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[#E2DEEC] bg-[#F7F5FA] px-4 py-3">
          <p className="text-xs font-medium text-[#8A80A8]">
            Showing{" "}
            <span className="font-semibold text-[#544A78]">
              {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}
              {" – "}
              {Math.min(
                (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
                rowCount,
              )}
            </span>{" "}
            of <span className="font-semibold text-[#544A78]">{rowCount}</span> rows
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="flex size-8 items-center justify-center rounded-lg border border-[#D4CFE2] bg-white text-xs font-medium text-[#544A78] disabled:opacity-40"
            >
              ‹
            </button>
            <span className="px-2 text-xs font-medium text-[#544A78]">
              {table.getState().pagination.pageIndex + 1} / {table.getPageCount() || 1}
            </span>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="flex size-8 items-center justify-center rounded-lg border border-[#D4CFE2] bg-white text-xs font-medium text-[#544A78] disabled:opacity-40"
            >
              ›
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
