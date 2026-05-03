"use client";

import { Fragment } from "react";
import type { QuerySummary } from "../../lib/agent/types";

interface Props {
  summary: QuerySummary;
}

/**
 * Display-only metadata strip beneath the result title. Shows what filters
 * were applied, which columns were projected, and how rows were sorted —
 * derived directly from `summary.filters/columns/sort` populated by the
 * agent's run_sql tool call. Renders nothing if all groups are empty so
 * the table sits closer to the title for trivial queries.
 */
export function ChipStrip({ summary }: Props) {
  const items = buildItems(summary);
  if (items.length === 0) return null;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-y-1.5 px-[18px] pb-3 pt-1.5 text-[11.5px] text-[#8A80A8]">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="mx-2.5 text-[#D4CFE2]">·</span>}
          <span className="inline-flex items-center gap-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#A69DC0]">
              {it.label}
            </span>
            <span className="font-medium text-[#544A78]">{it.value}</span>
          </span>
        </Fragment>
      ))}
    </div>
  );
}

interface ChipItem {
  label: string;
  value: string;
}

function buildItems(summary: QuerySummary): ChipItem[] {
  const items: ChipItem[] = [];

  for (const f of summary.filters ?? []) {
    if (typeof f === "string" && f.trim()) {
      items.push({ label: "Filter", value: f.trim() });
    }
  }

  const cols = (summary.columns ?? []).filter((c) => typeof c === "string" && c.trim());
  if (cols.length > 0) {
    items.push({ label: "Columns", value: collapseColumns(cols) });
  }

  if (summary.sort && summary.sort.trim()) {
    items.push({ label: "Sort", value: summary.sort.trim() });
  }

  return items;
}

const COLUMN_INLINE_LIMIT = 4;

function collapseColumns(cols: string[]): string {
  if (cols.length <= COLUMN_INLINE_LIMIT) return cols.join(", ");
  return `${cols.slice(0, 3).join(", ")} +${cols.length - 3} more`;
}
