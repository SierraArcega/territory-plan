"use client";

import { useMemo, useState } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";

interface Props {
  columns: string[];
  rows: Array<Record<string, unknown>>;
}

function isIdColumn(columnName: string): boolean {
  for (const tbl of Object.values(TABLE_REGISTRY)) {
    const match = tbl.columns.find((c) => c.column === columnName);
    if (match && (match.format as string) === "id") return true;
  }
  return /^(id|leaid|.*_id|uuid)$/i.test(columnName);
}

export function ResultsTable({ columns, rows }: Props) {
  const [showTechnical, setShowTechnical] = useState(false);

  const visibleColumns = useMemo(
    () => (showTechnical ? columns : columns.filter((c) => !isIdColumn(c))),
    [columns, showTechnical],
  );

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-lg border border-[#D4CFE2] bg-white p-8 text-center text-sm text-[#8A80A8] shadow-sm">
        No rows returned.
      </div>
    );
  }

  const hiddenCount = columns.length - visibleColumns.length;

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-[#D4CFE2] bg-white shadow-sm">
      <div className="flex shrink-0 items-center justify-between border-b border-[#E2DEEC] p-3">
        <div className="text-xs font-medium text-[#8A80A8]">
          {rows.length} row{rows.length === 1 ? "" : "s"}
          {hiddenCount > 0 && !showTechnical
            ? ` · ${hiddenCount} technical column${hiddenCount === 1 ? "" : "s"} hidden`
            : ""}
        </div>
        {hiddenCount > 0 && (
          <button
            type="button"
            onClick={() => setShowTechnical((v) => !v)}
            className="text-xs font-medium text-[#403770] transition-colors duration-100 hover:underline"
          >
            {showTechnical ? "Hide technical columns" : "Show technical columns"}
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-[#F7F5FA]">
            <tr>
              {visibleColumns.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="whitespace-nowrap border-b border-[#E2DEEC] px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[#544A78]"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#F7F5FA]">
                {visibleColumns.map((c) => (
                  <td
                    key={c}
                    className="whitespace-nowrap px-4 py-2 text-[#403770]"
                  >
                    {formatCell(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatCell(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "number") return v.toLocaleString();
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}
