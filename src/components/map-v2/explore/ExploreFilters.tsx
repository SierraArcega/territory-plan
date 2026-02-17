"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ExploreEntity, ExploreFilter, FilterOp } from "@/lib/map-v2-store";
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

interface ExploreFiltersProps {
  entity: ExploreEntity;
  filters: ExploreFilter[];
  onAddFilter: (filter: ExploreFilter) => void;
  onRemoveFilter: (filterId: string) => void;
  onClearAll: () => void;
}

// ---- Pill display helpers ----

function getColumnLabel(entity: ExploreEntity, columnKey: string): string {
  const col = COLUMNS_BY_ENTITY[entity].find((c) => c.key === columnKey);
  return col?.label ?? columnKey;
}

function formatFilterPill(entity: ExploreEntity, filter: ExploreFilter): string {
  const label = getColumnLabel(entity, filter.column);

  switch (filter.op) {
    case "contains":
      return `${label}: "${filter.value}"`;
    case "eq":
      return `${label}: ${filter.value}`;
    case "between": {
      const [min, max] = filter.value as [number, number];
      return `${label}: ${min.toLocaleString()}\u2013${max.toLocaleString()}`;
    }
    case "gte":
      return `${label} \u2265 ${typeof filter.value === "number" ? filter.value.toLocaleString() : filter.value}`;
    case "lte":
      return `${label} \u2264 ${typeof filter.value === "number" ? filter.value.toLocaleString() : filter.value}`;
    case "is_true":
      return `${label}: Yes`;
    case "is_false":
      return `${label}: No`;
    default:
      return `${label}: ${filter.value}`;
  }
}

// ---- Value Input Components ----

function TextFilterInput({
  onSubmit,
}: {
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="p-3 space-y-2">
      <input
        autoFocus
        type="text"
        placeholder="Contains..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && value.trim()) onSubmit(value.trim());
        }}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
      />
      <button
        disabled={!value.trim()}
        onClick={() => value.trim() && onSubmit(value.trim())}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

function EnumFilterInput({
  enumValues,
  onSubmit,
}: {
  enumValues: string[];
  onSubmit: (value: string) => void;
}) {
  return (
    <div className="p-2 max-h-48 overflow-y-auto">
      {enumValues.map((val) => (
        <button
          key={val}
          onClick={() => onSubmit(val)}
          className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-50 capitalize"
        >
          {val.replace(/_/g, " ")}
        </button>
      ))}
    </div>
  );
}

function NumberFilterInput({
  onSubmit,
}: {
  onSubmit: (op: FilterOp, value: number | [number, number]) => void;
}) {
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  const handleApply = () => {
    const hasMin = min !== "" && !isNaN(Number(min));
    const hasMax = max !== "" && !isNaN(Number(max));
    if (hasMin && hasMax) {
      onSubmit("between", [Number(min), Number(max)]);
    } else if (hasMin) {
      onSubmit("gte", Number(min));
    } else if (hasMax) {
      onSubmit("lte", Number(max));
    }
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus
          type="number"
          placeholder="Min"
          value={min}
          onChange={(e) => setMin(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
        />
        <input
          type="number"
          placeholder="Max"
          value={max}
          onChange={(e) => setMax(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleApply()}
          className="w-1/2 px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
        />
      </div>
      <button
        disabled={min === "" && max === ""}
        onClick={handleApply}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

function BooleanFilterInput({
  onSubmit,
}: {
  onSubmit: (op: FilterOp) => void;
}) {
  return (
    <div className="p-2">
      <button
        onClick={() => onSubmit("is_true")}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-50"
      >
        Yes
      </button>
      <button
        onClick={() => onSubmit("is_false")}
        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 rounded-md hover:bg-gray-50"
      >
        No
      </button>
    </div>
  );
}

function DateFilterInput({
  onSubmit,
}: {
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="p-3 space-y-2">
      <input
        autoFocus
        type="date"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/40"
      />
      <button
        disabled={!value}
        onClick={() => value && onSubmit(value)}
        className="w-full px-3 py-1.5 text-xs font-medium text-white bg-plum rounded-lg hover:bg-plum/90 disabled:opacity-40"
      >
        Apply
      </button>
    </div>
  );
}

// ---- Main Component ----

export default function ExploreFilters({
  entity,
  filters,
  onAddFilter,
  onRemoveFilter,
  onClearAll,
}: ExploreFiltersProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<ColumnDef | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Close picker on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
      setPickerOpen(false);
      setSelectedColumn(null);
    }
  }, []);

  useEffect(() => {
    if (pickerOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [pickerOpen, handleOutsideClick]);

  const columns = COLUMNS_BY_ENTITY[entity];

  // Group columns by group for the column picker
  const groupedColumns = columns.reduce<Record<string, ColumnDef[]>>((acc, col) => {
    if (!acc[col.group]) acc[col.group] = [];
    acc[col.group].push(col);
    return acc;
  }, {});

  const handleAddFilter = (op: FilterOp, value: ExploreFilter["value"]) => {
    if (!selectedColumn) return;
    onAddFilter({
      id: crypto.randomUUID(),
      column: selectedColumn.key,
      op,
      value,
    });
    setPickerOpen(false);
    setSelectedColumn(null);
  };

  // Render the value input based on filter type
  const renderValueInput = () => {
    if (!selectedColumn) return null;

    switch (selectedColumn.filterType) {
      case "text":
      case "tags":
        return (
          <TextFilterInput
            onSubmit={(val) => handleAddFilter("contains", val)}
          />
        );
      case "enum":
        return (
          <EnumFilterInput
            enumValues={selectedColumn.enumValues || []}
            onSubmit={(val) => handleAddFilter("eq", val)}
          />
        );
      case "number":
        return (
          <NumberFilterInput
            onSubmit={(op, val) => handleAddFilter(op, val)}
          />
        );
      case "boolean":
        return (
          <BooleanFilterInput
            onSubmit={(op) => handleAddFilter(op, true)}
          />
        );
      case "date":
        return (
          <DateFilterInput
            onSubmit={(val) => handleAddFilter("gte", val)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap min-w-0">
      {/* Active filter pills */}
      {filters.map((filter) => (
        <span
          key={filter.id}
          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-plum/10 text-plum rounded-full"
        >
          {formatFilterPill(entity, filter)}
          <button
            onClick={() => onRemoveFilter(filter.id)}
            className="hover:text-plum/70 ml-0.5"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3L9 9M9 3L3 9" />
            </svg>
          </button>
        </span>
      ))}

      {/* Add Filter button + picker */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => {
            setPickerOpen(!pickerOpen);
            setSelectedColumn(null);
          }}
          className="px-2.5 py-1 text-xs border border-dashed border-gray-300 rounded-full hover:bg-gray-50 text-gray-500"
        >
          + Add Filter
        </button>

        {pickerOpen && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg border border-gray-200 shadow-lg z-30">
            {!selectedColumn ? (
              // Step 1: Pick a column
              <div className="max-h-64 overflow-y-auto py-1">
                {Object.entries(groupedColumns).map(([group, cols]) => (
                  <div key={group}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      {group}
                    </div>
                    {cols.map((col) => (
                      <button
                        key={col.key}
                        onClick={() => setSelectedColumn(col)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {col.label}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              // Step 2: Enter value
              <div>
                <div className="px-3 pt-2.5 pb-1 flex items-center gap-1">
                  <button
                    onClick={() => setSelectedColumn(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M8.5 3.5L5 7L8.5 10.5" />
                    </svg>
                  </button>
                  <span className="text-xs font-medium text-gray-700">
                    {selectedColumn.label}
                  </span>
                </div>
                <div className="border-t border-gray-100">
                  {renderValueInput()}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clear all */}
      {filters.length > 0 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
