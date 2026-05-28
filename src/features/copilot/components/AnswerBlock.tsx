"use client";

import { MapPin } from "lucide-react";
import { isIdColumn } from "@/features/reports/lib/result-columns";
import { extractDistrictLeaids } from "../lib/plot-districts";

export interface AnswerPayload {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

export function AnswerBlock({
  answer,
  onViewOnMap,
}: {
  answer: AnswerPayload;
  onViewOnMap: () => void;
}) {
  const visibleColumns = answer.columns.filter((c) => !isIdColumn(c));
  const { leaids } = extractDistrictLeaids(answer.columns, answer.rows);

  return (
    <div className="space-y-2">
      {answer.rows.length === 0 ? (
        <p className="text-sm text-[#6E6390]">No rows.</p>
      ) : visibleColumns.length === 0 ? (
        <p className="text-sm text-[#6E6390]">Plotted on the map — open the Map tab to see them.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2DEEC]">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-[#F7F5FA]">
                {visibleColumns.map((c) => (
                  <th
                    key={c}
                    className="px-2 py-1 text-left font-semibold text-[#6E6390] whitespace-nowrap"
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {answer.rows.map((row, i) => (
                <tr key={i} className="border-t border-[#E2DEEC]">
                  {visibleColumns.map((c) => (
                    <td key={c} className="px-2 py-1 text-[#403770] whitespace-nowrap">
                      {row[c] == null ? "" : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {answer.rowCount > answer.rows.length && (
            <p className="px-2 py-1 text-[10px] text-[#6E6390]">
              Showing {answer.rows.length} of {answer.rowCount} rows.
            </p>
          )}
        </div>
      )}

      {leaids.length > 0 && (
        <button
          type="button"
          onClick={onViewOnMap}
          className="flex items-center gap-1.5 rounded-lg border border-[#403770] px-3 py-1.5 text-xs font-semibold text-[#403770] transition-colors hover:bg-[#403770] hover:text-white whitespace-nowrap"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
          View {leaids.length} on the map
        </button>
      )}
    </div>
  );
}
