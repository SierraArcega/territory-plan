"use client";

import { useMemo, useRef, useState } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import type { QueryParams } from "../../lib/types";
import ChipEditorPopover from "../ChipEditorPopover";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
}

export default function SortChip({ params, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const first = params.orderBy?.[0];
  const columnOptions = useMemo(() => {
    if (!params.table) return [];
    const meta = TABLE_REGISTRY[params.table];
    return (meta?.columns ?? [])
      .filter((c) => c.queryable)
      .map((c) => ({ column: c.column, label: c.label }));
  }, [params.table]);

  const summary = first
    ? `${first.column} ${first.direction === "desc" ? "↓" : "↑"}`
    : "—";

  const setOrder = (column: string, direction: "asc" | "desc") => {
    onChange({ ...params, orderBy: column ? [{ column, direction }] : undefined });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
        Sort
      </span>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!params.table}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] px-2.5 py-1.5 text-xs font-semibold ${
          first ? "bg-white text-[#544A78]" : "bg-[#F7F5FA] text-[#A69DC0]"
        } disabled:opacity-50`}
      >
        {summary}
        <span className="text-[10px] text-[#A69DC0]">▾</span>
      </button>
      <ChipEditorPopover
        anchor={ref.current}
        open={open}
        onClose={() => setOpen(false)}
        minWidth={280}
      >
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
            Column
            <select
              value={first?.column ?? ""}
              onChange={(e) =>
                setOrder(e.target.value, first?.direction ?? "desc")
              }
              className="rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#544A78]"
            >
              <option value="">No sort</option>
              {columnOptions.map((c) => (
                <option key={c.column} value={c.column}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
            Direction
            <select
              value={first?.direction ?? "desc"}
              onChange={(e) =>
                first &&
                setOrder(first.column, e.target.value as "asc" | "desc")
              }
              disabled={!first}
              className="rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#544A78] disabled:opacity-50"
            >
              <option value="desc">Descending ↓</option>
              <option value="asc">Ascending ↑</option>
            </select>
          </label>
        </div>
      </ChipEditorPopover>
    </div>
  );
}
