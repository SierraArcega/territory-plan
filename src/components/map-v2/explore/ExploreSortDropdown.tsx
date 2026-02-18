"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ExploreEntity, ExploreSortConfig } from "@/lib/map-v2-store";
import type { ColumnDef } from "./columns/districtColumns";
import { districtColumns } from "./columns/districtColumns";
import { activityColumns } from "./columns/activityColumns";
import { taskColumns } from "./columns/taskColumns";
import { contactColumns } from "./columns/contactColumns";

const COLUMNS_BY_ENTITY: Record<ExploreEntity, ColumnDef[]> = {
  districts: districtColumns,
  activities: activityColumns,
  tasks: taskColumns,
  contacts: contactColumns,
};

interface ExploreSortDropdownProps {
  entity: ExploreEntity;
  sorts: ExploreSortConfig[];
  onAddSort: (rule: ExploreSortConfig) => void;
  onRemoveSort: (column: string) => void;
  onReorderSorts: (rules: ExploreSortConfig[]) => void;
  onToggleDirection: (column: string) => void;
}

function getColumnLabel(entity: ExploreEntity, columnKey: string): string {
  const col = COLUMNS_BY_ENTITY[entity].find((c) => c.key === columnKey);
  return col?.label ?? columnKey;
}

export default function ExploreSortDropdown({
  entity,
  sorts,
  onAddSort,
  onRemoveSort,
  onReorderSorts,
  onToggleDirection,
}: ExploreSortDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
      setIsOpen(false);
      setShowColumnPicker(false);
      setSearchQuery("");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen, handleOutsideClick]);

  // Close when entity changes
  useEffect(() => {
    setIsOpen(false);
    setShowColumnPicker(false);
    setSearchQuery("");
  }, [entity]);

  // Column picker: filter out already-sorted columns, group by group, and search
  const columns = COLUMNS_BY_ENTITY[entity];
  const activeSortColumns = new Set(sorts.map((s) => s.column));

  const availableColumns = columns.filter(
    (col) => !activeSortColumns.has(col.key)
  );

  const filteredColumns = availableColumns.filter((col) =>
    searchQuery
      ? col.label.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const groupedColumns = filteredColumns.reduce<Record<string, ColumnDef[]>>(
    (acc, col) => {
      if (!acc[col.group]) acc[col.group] = [];
      acc[col.group].push(col);
      return acc;
    },
    {}
  );

  const handleSelectColumn = (col: ColumnDef) => {
    onAddSort({ column: col.key, direction: "asc" });
    setShowColumnPicker(false);
    setSearchQuery("");
  };

  // Drag handlers
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTargetIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDropTargetIndex(null);
      return;
    }

    const newSorts = [...sorts];
    const [moved] = newSorts.splice(dragIndex, 1);
    newSorts.splice(targetIndex, 0, moved);
    onReorderSorts(newSorts);
    setDragIndex(null);
    setDropTargetIndex(null);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (isOpen) {
            setShowColumnPicker(false);
            setSearchQuery("");
          }
        }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
          isOpen
            ? "bg-[#C4E7E6]/20 border-[#403770]/20 text-[#403770]"
            : "bg-white border-gray-200 text-gray-600 hover:border-[#403770]/20 hover:text-[#403770]"
        }`}
      >
        {/* Sort icon */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 4H12" />
          <path d="M4 7H10" />
          <path d="M6 10H8" />
        </svg>
        Sort
        {sorts.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold bg-[#403770] text-white rounded-full">
            {sorts.length}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {!showColumnPicker ? (
            // Sort rules list view
            <div>
              {sorts.length === 0 ? (
                <div className="px-3 py-4 text-center">
                  <p className="text-xs text-gray-400">No sort rules applied</p>
                  <p className="text-[11px] text-gray-300 mt-1">
                    Click &quot;+ Add sort&quot; to get started
                  </p>
                </div>
              ) : (
                <div className="py-1">
                  {sorts.map((sort, index) => (
                    <div
                      key={sort.column}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, index)}
                      className={`flex items-center gap-1.5 px-2 py-1.5 group transition-colors ${
                        dragIndex === index
                          ? "opacity-40"
                          : "hover:bg-gray-50"
                      } ${
                        dropTargetIndex === index && dragIndex !== null && dragIndex !== index
                          ? "border-t-2 border-[#403770]"
                          : "border-t-2 border-transparent"
                      }`}
                    >
                      {/* Drag handle */}
                      <span className="cursor-grab text-gray-300 group-hover:text-gray-400 transition-colors select-none text-sm leading-none flex-shrink-0">
                        &#x2807;&#x2807;
                      </span>

                      {/* Column label */}
                      <span className="text-[13px] text-gray-700 truncate flex-1 min-w-0">
                        {getColumnLabel(entity, sort.column)}
                      </span>

                      {/* Asc/Desc toggle */}
                      <button
                        onClick={() => onToggleDirection(sort.column)}
                        className="flex-shrink-0 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 text-gray-500 hover:border-[#403770]/30 hover:text-[#403770] hover:bg-[#C4E7E6]/10 transition-all"
                        title={sort.direction === "asc" ? "Ascending - click to toggle" : "Descending - click to toggle"}
                      >
                        {sort.direction === "asc" ? (
                          <span className="inline-flex items-center gap-0.5">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 8V2M5 2L2.5 4.5M5 2L7.5 4.5" />
                            </svg>
                            Asc
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M5 2V8M5 8L2.5 5.5M5 8L7.5 5.5" />
                            </svg>
                            Desc
                          </span>
                        )}
                      </button>

                      {/* Remove button */}
                      <button
                        onClick={() => onRemoveSort(sort.column)}
                        className="flex-shrink-0 text-gray-300 hover:text-[#F37167] transition-colors"
                        title="Remove sort"
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 12 12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        >
                          <path d="M3 3L9 9M9 3L3 9" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add sort button */}
              <div className="border-t border-gray-100 px-2 py-1.5">
                <button
                  onClick={() => {
                    setShowColumnPicker(true);
                    setSearchQuery("");
                  }}
                  disabled={availableColumns.length === 0}
                  className="w-full text-left px-2 py-1.5 text-xs font-medium text-gray-500 hover:text-[#403770] hover:bg-[#C4E7E6]/10 rounded-md transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  + Add sort
                </button>
              </div>
            </div>
          ) : (
            // Column picker view
            <div>
              <div className="px-2 pt-2 pb-1 flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setShowColumnPicker(false);
                    setSearchQuery("");
                  }}
                  className="text-gray-400 hover:text-[#403770] transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M8.5 3.5L5 7L8.5 10.5" />
                  </svg>
                </button>
                <span className="text-xs font-semibold text-[#403770]">
                  Choose column
                </span>
              </div>

              <div className="px-2 pb-1">
                <input
                  autoFocus
                  type="text"
                  placeholder="Search columns..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#403770]/40"
                />
              </div>

              <div className="max-h-64 overflow-y-auto py-1">
                {Object.entries(groupedColumns).map(([group, cols]) => (
                  <div key={group}>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {group}
                    </div>
                    {cols.map((col) => (
                      <button
                        key={col.key}
                        onClick={() => handleSelectColumn(col)}
                        className="w-full text-left px-3 py-1.5 text-[13px] text-gray-700 hover:bg-[#C4E7E6]/15 hover:text-[#403770] transition-colors"
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                ))}
                {Object.keys(groupedColumns).length === 0 && (
                  <p className="px-3 py-4 text-xs text-gray-400 text-center">
                    {availableColumns.length === 0
                      ? "All columns are already sorted"
                      : "No matching columns"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
