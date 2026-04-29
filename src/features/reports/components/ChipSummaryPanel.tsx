"use client";

import { X } from "lucide-react";
import type { ChipEditAction, QuerySummary } from "../lib/agent/types";

interface Props {
  summary: QuerySummary;
  onEdit: (action: ChipEditAction) => void;
  onSave: () => void;
}

export function ChipSummaryPanel({ summary, onEdit, onSave }: Props) {
  return (
    <section className="rounded-xl border border-[#D4CFE2] bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-[#403770]">{summary.source}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#8A80A8]">
          Filters
        </span>
        {summary.filters.length === 0 && (
          <span className="text-sm text-[#8A80A8]">none</span>
        )}
        {summary.filters.map((f) => (
          <Chip
            key={f.id}
            label={`${f.label}: ${f.operator ? f.operator + " " : ""}${f.value}`}
            onRemove={() =>
              onEdit({
                type: "remove_filter",
                chipId: f.id,
                label: `${f.label}: ${f.value}`,
              })
            }
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-[#8A80A8]">
          Columns
        </span>
        {summary.columns.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            onRemove={() =>
              onEdit({ type: "remove_column", columnId: c.id, label: c.label })
            }
          />
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-[#6E6390]">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[#8A80A8]">
            Sort
          </span>{" "}
          {summary.sort
            ? `${summary.sort.column} ${summary.sort.direction === "desc" ? "↓" : "↑"}`
            : "none"}
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-[#8A80A8]">
            Limit
          </span>{" "}
          {summary.limit}
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={onSave}
          className="rounded-lg bg-[#403770] px-4 py-2 text-sm font-medium text-white hover:bg-[#322a5a]"
        >
          Save as report
        </button>
      </div>
    </section>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-3 py-1 text-sm text-[#403770]">
      {label}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        onClick={onRemove}
        className="rounded-full p-0.5 text-[#8A80A8] hover:bg-[#EFEDF5] hover:text-[#403770]"
      >
        <X size={14} />
      </button>
    </span>
  );
}
