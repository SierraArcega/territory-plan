"use client";

import { useRef, useState } from "react";
import {
  SEMANTIC_CONTEXT,
  TABLE_REGISTRY,
} from "@/lib/district-column-metadata";
import type { QueryParams } from "../../lib/types";
import { DEFAULT_LIMIT } from "../../lib/types";
import { DomainDot } from "../ui/icons";
import ChipEditorPopover from "../ChipEditorPopover";

interface Props {
  params: QueryParams;
  onChange: (params: QueryParams) => void;
}

function availableTables(): string[] {
  const excluded = new Set(SEMANTIC_CONTEXT.excludedTables);
  return Object.keys(TABLE_REGISTRY)
    .filter((t) => !excluded.has(t))
    .sort();
}

export default function SourceChip({ params, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const tables = availableTables();
  const selected = params.table || "Pick a source";
  const hasSource = Boolean(params.table);

  const handlePick = (table: string) => {
    onChange({
      table,
      columns: undefined,
      filters: [],
      groupBy: undefined,
      aggregations: undefined,
      orderBy: undefined,
      joins: undefined,
      limit: params.limit ?? DEFAULT_LIMIT,
    });
    setOpen(false);
  };

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.6px] text-[#A69DC0]">
          Source
        </span>
        <button
          ref={ref}
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`inline-flex items-center gap-1.5 rounded-full border border-[#D4CFE2] px-2.5 py-1.5 text-xs font-medium transition-colors ${
            hasSource
              ? "bg-white text-[#544A78] font-semibold"
              : "bg-[#F7F5FA] text-[#A69DC0]"
          }`}
        >
          {hasSource && <DomainDot kind="source" />}
          <span>{selected}</span>
          <span className="text-[10px] text-[#A69DC0]">▾</span>
        </button>
      </div>
      <ChipEditorPopover
        anchor={ref.current}
        open={open}
        onClose={() => setOpen(false)}
        minWidth={260}
      >
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#A69DC0]">
          Pick a source table
        </p>
        <div className="max-h-72 overflow-y-auto">
          {tables.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => handlePick(t)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors hover:bg-[#F7F5FA] ${
                t === params.table
                  ? "bg-[#F5F2FB] text-[#403770] font-semibold"
                  : "text-[#544A78]"
              }`}
            >
              <DomainDot kind="source" />
              {t}
            </button>
          ))}
        </div>
      </ChipEditorPopover>
    </>
  );
}
