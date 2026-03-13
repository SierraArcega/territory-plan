"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminColumnPickerProps {
  columnDefs: ColumnDef[];
  visibleColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminColumnPicker({
  columnDefs,
  visibleColumns,
  onColumnsChange,
}: AdminColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Group columns by group
  const groups = useMemo(() => {
    const map = new Map<string, ColumnDef[]>();
    for (const col of columnDefs) {
      const group = col.group || "Other";
      if (!map.has(group)) map.set(group, []);
      map.get(group)!.push(col);
    }
    return Array.from(map.entries());
  }, [columnDefs]);

  const defaultColumns = useMemo(
    () => columnDefs.filter((c) => c.isDefault).map((c) => c.key),
    [columnDefs]
  );

  const visibleSet = useMemo(() => new Set(visibleColumns), [visibleColumns]);

  function handleToggle(key: string) {
    if (visibleSet.has(key)) {
      onColumnsChange(visibleColumns.filter((k) => k !== key));
    } else {
      onColumnsChange([...visibleColumns, key]);
    }
  }

  function handleReset() {
    onColumnsChange(defaultColumns);
  }

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6390] border border-[#D4CFE2] rounded-lg px-3 py-1.5 hover:bg-[#EFEDF5] transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7"
          />
        </svg>
        Columns
      </button>

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full right-0 mt-1 z-30 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg p-3 w-64"
        >
          <div className="space-y-3 max-h-72 overflow-y-auto">
            {groups.map(([group, cols]) => (
              <div key={group}>
                <div className="text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider mb-1.5">
                  {group}
                </div>
                <div className="space-y-1">
                  {cols.map((col) => (
                    <label
                      key={col.key}
                      className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-[#EFEDF5] rounded transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={visibleSet.has(col.key)}
                        onChange={() => handleToggle(col.key)}
                        className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-[#403770] focus:ring-[#403770]/30"
                      />
                      <span className="text-xs text-[#6E6390]">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 pt-2 border-t border-[#E2DEEC]">
            <button
              onClick={handleReset}
              className="text-xs text-[#403770] hover:underline"
            >
              Reset to defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
