"use client";

import { useMemo, useRef, useState } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import type { Filter, FilterOp, QueryParams } from "../../lib/types";
import ChipEditorPopover from "../ChipEditorPopover";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
}

const OPS: { value: FilterOp; label: string; needsValue: boolean }[] = [
  { value: "eq", label: "=", needsValue: true },
  { value: "neq", label: "≠", needsValue: true },
  { value: "gt", label: ">", needsValue: true },
  { value: "gte", label: "≥", needsValue: true },
  { value: "lt", label: "<", needsValue: true },
  { value: "lte", label: "≤", needsValue: true },
  { value: "ilike", label: "contains", needsValue: true },
  { value: "isNull", label: "is empty", needsValue: false },
  { value: "isNotNull", label: "is not empty", needsValue: false },
];

function summarize(f: Filter, columnLabel: string): string {
  const op = OPS.find((o) => o.value === f.op);
  if (!op) return `${columnLabel}`;
  if (!op.needsValue) return `${columnLabel} ${op.label}`;
  const val = Array.isArray(f.value) ? f.value.join(", ") : String(f.value ?? "");
  return `${columnLabel} ${op.label} ${val}`;
}

export default function FilterChips({ params, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [column, setColumn] = useState("");
  const [opValue, setOpValue] = useState<FilterOp>("eq");
  const [value, setValue] = useState("");
  const addRef = useRef<HTMLButtonElement>(null);

  const columnOptions = useMemo(() => {
    if (!params.table) return [];
    const meta = TABLE_REGISTRY[params.table];
    if (!meta) return [];
    return meta.columns
      .filter((c) => c.queryable)
      .map((c) => ({ column: c.column, label: c.label }));
  }, [params.table]);

  const columnLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    columnOptions.forEach((c) => map.set(c.column, c.label));
    return map;
  }, [columnOptions]);

  const addFilter = () => {
    if (!column) return;
    const opMeta = OPS.find((o) => o.value === opValue);
    if (!opMeta) return;
    const filter: Filter = { column, op: opValue };
    if (opMeta.needsValue) {
      if (!value.trim()) return;
      filter.value = value.trim();
    }
    onChange({ ...params, filters: [...(params.filters ?? []), filter] });
    setColumn("");
    setOpValue("eq");
    setValue("");
    setOpen(false);
  };

  const removeFilter = (idx: number) => {
    const next = (params.filters ?? []).filter((_, i) => i !== idx);
    onChange({ ...params, filters: next.length ? next : undefined });
  };

  const selectedOpMeta = OPS.find((o) => o.value === opValue);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
        Filters
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {(params.filters ?? []).map((f, i) => (
          <button
            key={`${f.column}-${i}`}
            type="button"
            onClick={() => removeFilter(i)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#544A78]"
          >
            {summarize(f, columnLabelMap.get(f.column) ?? f.column)}
            <span className="text-[10px] text-[#A69DC0]">×</span>
          </button>
        ))}
        <button
          ref={addRef}
          type="button"
          onClick={() => setOpen(true)}
          disabled={!params.table}
          className="inline-flex items-center rounded-full border border-[#D4CFE2] bg-[#F7F5FA] px-2.5 py-1.5 text-xs font-medium text-[#8A80A8] disabled:opacity-50"
        >
          + Add filter
        </button>
      </div>
      <ChipEditorPopover
        anchor={addRef.current}
        open={open}
        onClose={() => setOpen(false)}
        minWidth={320}
      >
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
            Column
            <select
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className="rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#544A78]"
            >
              <option value="">Choose a column…</option>
              {columnOptions.map((c) => (
                <option key={c.column} value={c.column}>
                  {c.label} ({c.column})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
            Condition
            <select
              value={opValue}
              onChange={(e) => setOpValue(e.target.value as FilterOp)}
              className="rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#544A78]"
            >
              {OPS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          {selectedOpMeta?.needsValue && (
            <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
              Value
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={opValue === "ilike" ? "%search%" : "value"}
                className="rounded-lg border border-[#C2BBD4] bg-white px-2 py-1.5 text-sm text-[#544A78]"
              />
            </label>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-[#D4CFE2] px-3 py-1.5 text-xs font-medium text-[#544A78]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addFilter}
              className="rounded-lg bg-plum px-3 py-1.5 text-xs font-semibold text-white"
            >
              Add filter
            </button>
          </div>
        </div>
      </ChipEditorPopover>
    </div>
  );
}
