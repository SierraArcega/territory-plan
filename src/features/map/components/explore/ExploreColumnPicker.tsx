"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import type { ExploreEntity } from "@/features/map/lib/store";
import { districtColumns, getCompetitorColumns } from "./columns/districtColumns";
import { useCompetitorFYs } from "@/lib/api";
import { activityColumns } from "./columns/activityColumns";
import { taskColumns } from "./columns/taskColumns";
import { contactColumns } from "./columns/contactColumns";
import { planColumns } from "./columns/planColumns";
import type { ColumnDef } from "./columns/districtColumns";

const COLUMN_DEFS_BY_ENTITY: Record<ExploreEntity, ColumnDef[]> = {
  districts: districtColumns,
  activities: activityColumns,
  tasks: taskColumns,
  contacts: contactColumns,
  plans: planColumns,
};

interface ExploreColumnPickerProps {
  entity: ExploreEntity;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
}

export default function ExploreColumnPicker({
  entity,
  selectedColumns,
  onColumnsChange,
}: ExploreColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: competitorFYs } = useCompetitorFYs();
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  // Close when entity changes
  useEffect(() => {
    setIsOpen(false);
  }, [entity]);

  const columnDefs = useMemo(() => {
    const base = COLUMN_DEFS_BY_ENTITY[entity];
    if (entity !== "districts" || !competitorFYs?.length) return base;
    return [...base, ...getCompetitorColumns(competitorFYs)];
  }, [entity, competitorFYs]);

  // Group columns by their group field, preserving insertion order
  const grouped = useMemo(() => {
    const map = new Map<string, ColumnDef[]>();
    for (const col of columnDefs) {
      const list = map.get(col.group);
      if (list) {
        list.push(col);
      } else {
        map.set(col.group, [col]);
      }
    }
    return map;
  }, [columnDefs]);

  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      // Don't allow removing the last column
      if (selectedColumns.length <= 1) return;
      onColumnsChange(selectedColumns.filter((c) => c !== key));
    } else {
      onColumnsChange([...selectedColumns, key]);
    }
  };

  const selectAll = () => {
    onColumnsChange(columnDefs.map((c) => c.key));
  };

  const resetToDefaults = () => {
    onColumnsChange(columnDefs.filter((c) => c.isDefault).map((c) => c.key));
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          isOpen
            ? "bg-[#C4E7E6]/20 border-[#403770]/20 text-[#403770]"
            : "bg-white border-gray-200 text-gray-600 hover:border-[#403770]/20 hover:text-[#403770]"
        }`}
      >
        {/* Columns icon (three horizontal lines) */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <path d="M2 3.5H12" />
          <path d="M2 7H12" />
          <path d="M2 10.5H12" />
        </svg>
        Columns
        <span className="text-gray-400 tabular-nums">
          {selectedColumns.length}/{columnDefs.length}
        </span>
      </button>

      {/* Dropdown popover */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50 flex flex-col max-h-80 overflow-hidden">
          {/* Header with actions */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
            <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Visible Columns
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="text-[11px] text-[#403770] hover:text-[#403770]/70 font-medium transition-colors"
              >
                All
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={resetToDefaults}
                className="text-[11px] text-[#403770] hover:text-[#403770]/70 font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Scrollable grouped list */}
          <div className="overflow-y-auto flex-1">
            {Array.from(grouped.entries()).map(([group, columns]) => (
              <div key={group}>
                {/* Sticky group header */}
                <div className="sticky top-0 bg-gray-50/80 px-3 py-1.5 border-b border-gray-100">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {group}
                  </span>
                </div>

                {/* Column checkboxes */}
                {columns.map((col) => {
                  const isChecked = selectedColumns.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#C4E7E6]/10 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleColumn(col.key)}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30 cursor-pointer"
                      />
                      <span
                        className={`text-xs ${
                          isChecked ? "text-[#403770] font-medium" : "text-gray-500"
                        }`}
                      >
                        {col.label}
                      </span>
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
