"use client";

import { useMemo, useRef, useState } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import type { QueryParams } from "../../lib/types";
import ChipEditorPopover from "../ChipEditorPopover";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
}

export default function ColumnsChip({ params, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const available = useMemo(() => {
    if (!params.table) return [];
    const tables = [params.table, ...(params.joins?.map((j) => j.toTable) ?? [])];
    const rows: { table: string; column: string; label: string }[] = [];
    for (const t of tables) {
      const meta = TABLE_REGISTRY[t];
      if (!meta) continue;
      for (const c of meta.columns) {
        if (c.queryable) rows.push({ table: t, column: c.column, label: c.label });
      }
    }
    return rows;
  }, [params.table, params.joins]);

  const hasJoins = (params.joins?.length ?? 0) > 0;
  const selected = new Set(params.columns ?? []);
  const count = selected.size;

  const toggle = (col: string, qualified: string) => {
    const key = hasJoins ? qualified : col;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ ...params, columns: next.size ? Array.from(next) : undefined });
  };

  const summary = count === 0 ? "—" : `${count} column${count === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
        Columns
      </span>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={!params.table}
        className={`inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] px-2.5 py-1.5 text-xs font-semibold ${
          count > 0 ? "bg-white text-[#544A78]" : "bg-[#F7F5FA] text-[#A69DC0]"
        } disabled:opacity-50`}
      >
        {summary}
        <span className="text-[10px] text-[#A69DC0]">▾</span>
      </button>
      <ChipEditorPopover
        anchor={ref.current}
        open={open}
        onClose={() => setOpen(false)}
        minWidth={320}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
          Choose columns
        </p>
        <div className="max-h-80 overflow-y-auto flex flex-col gap-0.5">
          {available.map((c) => {
            const qualified = `${c.table}.${c.column}`;
            const key = hasJoins ? qualified : c.column;
            const isOn = selected.has(key);
            return (
              <label
                key={qualified}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#544A78] hover:bg-[#F7F5FA] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isOn}
                  onChange={() => toggle(c.column, qualified)}
                  className="size-3.5"
                />
                <span className="font-medium">{c.label}</span>
                {hasJoins && (
                  <span className="ml-auto text-[10px] text-[#A69DC0]">{c.table}</span>
                )}
              </label>
            );
          })}
        </div>
      </ChipEditorPopover>
    </div>
  );
}
