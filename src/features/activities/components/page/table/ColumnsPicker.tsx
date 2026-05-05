"use client";

import { useState, useRef, useEffect } from "react";
import { Columns3, Square, SquareCheck } from "lucide-react";
import { ACTIVITIES_TABLE_COLUMNS, DEFAULT_COLUMN_KEYS } from "./columns";
import { cn } from "@/features/shared/lib/cn";

interface ColumnsPickerProps {
  visibleColumns: string[];
  onChange: (next: string[]) => void;
}

// Compact dropdown for toggling which Table columns are visible. Groups by
// `group` field on each ColumnDef, with "Reset" restoring the default set.
export default function ColumnsPicker({ visibleColumns, onChange }: ColumnsPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = ACTIVITIES_TABLE_COLUMNS.reduce<Record<string, typeof ACTIVITIES_TABLE_COLUMNS>>(
    (acc, col) => {
      (acc[col.group] ??= []).push(col);
      return acc;
    },
    {}
  );

  function toggle(key: string) {
    if (visibleColumns.includes(key)) {
      // Don't allow removing the last column.
      if (visibleColumns.length === 1) return;
      onChange(visibleColumns.filter((k) => k !== key));
    } else {
      onChange([...visibleColumns, key]);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <Columns3 className="w-3.5 h-3.5" />
        Columns
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 w-64 bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-2">
          {Object.entries(groups).map(([groupName, cols]) => (
            <div key={groupName} className="mb-1.5">
              <div className="px-2 pt-1 pb-0.5 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8A80A8]">
                {groupName}
              </div>
              {cols.map((col) => {
                const active = visibleColumns.includes(col.key);
                const Checkbox = active ? SquareCheck : Square;
                return (
                  <button
                    key={col.key}
                    type="button"
                    onClick={() => toggle(col.key)}
                    aria-pressed={active}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                      active ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
                    )}
                  >
                    <Checkbox className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-[#403770]" : "text-[#A69DC0]")} />
                    {col.label}
                  </button>
                );
              })}
            </div>
          ))}
          <div className="flex items-center justify-between px-2 pt-2 mt-1 border-t border-[#EFEDF5]">
            <button
              type="button"
              onClick={() => onChange([...DEFAULT_COLUMN_KEYS])}
              className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#544A78] hover:text-[#403770]"
            >
              Reset to default
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#403770]"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
