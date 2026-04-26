"use client";

import { useMemo, useRef, useState } from "react";
import { TABLE_REGISTRY } from "@/lib/district-column-metadata";
import type { Join, QueryParams } from "../../lib/types";
import { DomainDot } from "../ui/icons";
import ChipEditorPopover from "../ChipEditorPopover";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
}

export default function IncludingChips({ params, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);

  const candidates = useMemo(() => {
    if (!params.table) return [];
    const root = TABLE_REGISTRY[params.table];
    if (!root) return [];
    const existing = new Set((params.joins ?? []).map((j) => j.toTable));
    return root.relationships
      .map((r) => {
        const key = r.alias ?? r.toTable;
        return {
          key,
          label:
            r.alias && r.alias !== r.toTable
              ? `${r.alias} (${r.toTable})`
              : r.toTable,
          through: r.through ?? [],
        };
      })
      .filter((c) => !existing.has(c.key));
  }, [params.table, params.joins]);

  const addJoin = (toTable: string) => {
    const next: Join[] = [...(params.joins ?? []), { toTable }];
    onChange({ ...params, joins: next });
    setOpen(false);
  };

  const removeJoin = (toTable: string) => {
    const next = (params.joins ?? []).filter((j) => j.toTable !== toTable);
    onChange({ ...params, joins: next.length ? next : undefined });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
        Including
      </span>
      <div className="flex items-center gap-1.5 flex-wrap">
        {(params.joins ?? []).map((j) => (
          <button
            key={j.toTable}
            type="button"
            onClick={() => removeJoin(j.toTable)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#544A78]"
          >
            <DomainDot kind="join" />
            {j.toTable}
            <span className="text-[10px] text-[#A69DC0]">×</span>
          </button>
        ))}
        <button
          ref={addRef}
          type="button"
          onClick={() => setOpen(true)}
          disabled={candidates.length === 0}
          className="inline-flex items-center rounded-full border border-[#D4CFE2] bg-[#F7F5FA] px-2.5 py-1.5 text-xs font-medium text-[#8A80A8] disabled:opacity-50"
        >
          + Add data
        </button>
      </div>
      <ChipEditorPopover
        anchor={addRef.current}
        open={open}
        onClose={() => setOpen(false)}
        minWidth={240}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
          Add a related source
        </p>
        {candidates.length === 0 && (
          <p className="text-xs text-[#8A80A8]">
            No more relationships available from {params.table}.
          </p>
        )}
        {candidates.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => addJoin(c.key)}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-[#544A78] hover:bg-[#F7F5FA]"
          >
            <DomainDot kind="join" />
            <span>{c.label}</span>
            {c.through.length > 0 && (
              <span className="ml-auto text-[10px] text-[#A69DC0]">
                via {c.through.join(", ")}
              </span>
            )}
          </button>
        ))}
      </ChipEditorPopover>
    </div>
  );
}
