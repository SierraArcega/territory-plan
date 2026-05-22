"use client";
import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { SOURCE_COLUMNS, type ColumnDef } from "@/features/views/lib/columns";
import type { SavedListSource } from "@/lib/saved-views/filter-tree";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import { SortFieldPicker } from "./SortFieldPicker";
import { AnchoredPopover } from "./AnchoredPopover";

interface GridSortChipsProps {
  source: SavedListSource;
  layout: GridViewLayout;
  onChange: (next: GridViewLayout) => void;
}

const SUPERSCRIPT_DIGITS = ["⁰", "¹", "²", "³", "⁴", "⁵", "⁶", "⁷", "⁸", "⁹"];

function toSuperscript(n: number): string {
  return String(n)
    .split("")
    .map((d) => SUPERSCRIPT_DIGITS[Number(d)] ?? d)
    .join("");
}

export function GridSortChips({
  source,
  layout,
  onChange,
}: GridSortChipsProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const usedFieldIds = layout.sort.map((s) => s.id);

  const addSort = (column: ColumnDef) => {
    onChange({
      ...layout,
      sort: [...layout.sort, { id: column.id, dir: "asc" }],
    });
    setPickerOpen(false);
  };

  const flipDirection = (index: number) => {
    const next = layout.sort.slice();
    const current = next[index];
    next[index] = { ...current, dir: current.dir === "asc" ? "desc" : "asc" };
    onChange({ ...layout, sort: next });
  };

  const removeAt = (index: number) =>
    onChange({
      ...layout,
      sort: layout.sort.filter((_, i) => i !== index),
    });

  const clearAll = () => onChange({ ...layout, sort: [] });

  const showStackIndex = layout.sort.length > 1;

  return (
    <div ref={wrapRef} className="relative inline-flex items-center gap-2">
      {layout.sort.map((entry, i) => {
        const col = SOURCE_COLUMNS[source].find((c) => c.id === entry.id);
        const label = col?.header ?? entry.id;
        const Icon = entry.dir === "desc" ? ArrowDown : ArrowUp;
        return (
          <div
            key={`${entry.id}-${i}`}
            className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-2 py-0.5 text-[12px] text-[#403770] hover:bg-[#EFEDF5]"
          >
            <button
              type="button"
              onClick={() => flipDirection(i)}
              className="inline-flex items-center gap-1 rounded-full focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-[#403770]/40"
              aria-label={`Toggle ${label} direction`}
            >
              <Icon className="h-3 w-3" />
              <span className="whitespace-nowrap font-medium">{label}</span>
              {showStackIndex && (
                <span className="whitespace-nowrap text-[10px] text-[#8A80A8]">
                  {toSuperscript(i + 1)}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={`Remove sort ${label}`}
              onClick={() => removeAt(i)}
              className="ml-1 text-[#8A80A8] hover:text-[#403770]"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={() => setPickerOpen((v) => !v)}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed border-[#E2DEEC] px-2 py-0.5 text-[12px] text-[#544A78] hover:bg-[#F7F5FA]"
      >
        <Plus className="h-3 w-3" />
        <span className="whitespace-nowrap">Sort</span>
      </button>

      {layout.sort.length >= 2 && (
        <button
          type="button"
          onClick={clearAll}
          className="ml-2 shrink-0 whitespace-nowrap text-[11px] text-[#8A80A8] underline hover:text-[#403770]"
        >
          Clear all
        </button>
      )}

      <AnchoredPopover
        anchorRef={wrapRef}
        open={pickerOpen}
        onDismiss={() => setPickerOpen(false)}
      >
        <SortFieldPicker
          source={source}
          usedFieldIds={usedFieldIds}
          onPick={addSort}
          onClose={() => setPickerOpen(false)}
        />
      </AnchoredPopover>
    </div>
  );
}
