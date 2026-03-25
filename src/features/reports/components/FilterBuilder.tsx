"use client";

import { useState, useRef, useEffect } from "react";
import type { FilterDef, FilterOp, ColumnSchema } from "../lib/types";
import FilterPill from "./FilterPill";

/** Operators available per column type */
const OPS_BY_TYPE: Record<string, { value: FilterOp; label: string }[]> = {
  string: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "not equals" },
    { value: "contains", label: "contains" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  number: [
    { value: "eq", label: "equals" },
    { value: "neq", label: "not equals" },
    { value: "gt", label: "greater than" },
    { value: "gte", label: "greater or equal" },
    { value: "lt", label: "less than" },
    { value: "lte", label: "less or equal" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
  boolean: [
    { value: "is_true", label: "is true" },
    { value: "is_false", label: "is false" },
  ],
  date: [
    { value: "eq", label: "equals" },
    { value: "gt", label: "after" },
    { value: "lt", label: "before" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ],
};

const NO_VALUE_OPS: FilterOp[] = [
  "is_true",
  "is_false",
  "is_empty",
  "is_not_empty",
];

interface FilterBuilderProps {
  availableColumns: ColumnSchema[];
  filters: FilterDef[];
  onChange: (filters: FilterDef[]) => void;
  disabled: boolean;
}

export default function FilterBuilder({
  availableColumns,
  filters,
  onChange,
  disabled,
}: FilterBuilderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"column" | "op" | "value">("column");
  const [selectedColumn, setSelectedColumn] = useState<ColumnSchema | null>(
    null
  );
  const [selectedOp, setSelectedOp] = useState<FilterOp | null>(null);
  const [valueInput, setValueInput] = useState("");
  const [columnSearch, setColumnSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        resetPopover();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const resetPopover = () => {
    setIsOpen(false);
    setStep("column");
    setSelectedColumn(null);
    setSelectedOp(null);
    setValueInput("");
    setColumnSearch("");
  };

  const handleColumnSelect = (col: ColumnSchema) => {
    setSelectedColumn(col);
    setStep("op");
  };

  const handleOpSelect = (op: FilterOp) => {
    setSelectedOp(op);
    if (NO_VALUE_OPS.includes(op)) {
      // No value needed — add the filter immediately
      addFilter(selectedColumn!, op, undefined);
      return;
    }
    setStep("value");
  };

  const handleValueSubmit = () => {
    if (!selectedColumn || !selectedOp) return;

    let parsedValue: unknown = valueInput;
    if (selectedColumn.type === "number") {
      parsedValue = Number(valueInput);
      if (isNaN(parsedValue as number)) return;
    }

    addFilter(selectedColumn, selectedOp, parsedValue);
  };

  const addFilter = (col: ColumnSchema, op: FilterOp, value: unknown) => {
    const newFilter: FilterDef = { column: col.key, op, value };
    onChange([...filters, newFilter]);
    resetPopover();
  };

  const removeFilter = (index: number) => {
    onChange(filters.filter((_, i) => i !== index));
  };

  const getColumnLabel = (key: string) => {
    return availableColumns.find((c) => c.key === key)?.label ?? key;
  };

  const filteredColumns = columnSearch
    ? availableColumns.filter(
        (c) =>
          c.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
          c.key.toLowerCase().includes(columnSearch.toLowerCase())
      )
    : availableColumns;

  const ops = selectedColumn
    ? OPS_BY_TYPE[selectedColumn.type] ?? OPS_BY_TYPE.string
    : [];

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[36px]">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#8A80A8] flex-shrink-0">
        Filters
      </span>

      {/* Active filter pills */}
      {filters.map((filter, idx) => (
        <FilterPill
          key={`${filter.column}-${filter.op}-${idx}`}
          filter={filter}
          columnLabel={getColumnLabel(filter.column)}
          onRemove={() => removeFilter(idx)}
        />
      ))}

      {/* Add filter button + popover */}
      {!disabled && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2.5 py-1 border border-dashed border-[#C2BBD4] rounded-full text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] hover:border-[#403770] hover:text-[#403770] transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg
              className="w-3 h-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Filter
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg z-30 overflow-hidden">
              {/* Step 1: Choose column */}
              {step === "column" && (
                <>
                  <div className="p-2 border-b border-[#E2DEEC]">
                    <input
                      type="text"
                      value={columnSearch}
                      onChange={(e) => setColumnSearch(e.target.value)}
                      placeholder="Search columns..."
                      className="w-full px-3 py-1.5 text-sm text-[#403770] bg-[#F7F5FA] border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {filteredColumns.map((col) => (
                      <button
                        key={col.key}
                        onClick={() => handleColumnSelect(col)}
                        className="w-full text-left px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100 flex items-center justify-between"
                      >
                        <span>{col.label}</span>
                        <span className="text-[10px] font-medium text-[#A69DC0] uppercase tracking-wider">
                          {col.type}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step 2: Choose operator */}
              {step === "op" && selectedColumn && (
                <>
                  <div className="px-3 py-2 border-b border-[#E2DEEC] bg-[#F7F5FA]">
                    <div className="text-xs text-[#8A80A8] font-medium">
                      {selectedColumn.label}
                    </div>
                  </div>
                  <div className="max-h-60 overflow-y-auto py-1">
                    {ops.map((op) => (
                      <button
                        key={op.value}
                        onClick={() => handleOpSelect(op.value)}
                        className="w-full text-left px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100"
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Step 3: Enter value */}
              {step === "value" && selectedColumn && selectedOp && (
                <div className="p-3">
                  <div className="text-xs text-[#8A80A8] font-medium mb-2">
                    {selectedColumn.label}{" "}
                    <span className="text-[#6E6390]">
                      {OPS_BY_TYPE[selectedColumn.type]?.find(
                        (o) => o.value === selectedOp
                      )?.label ?? selectedOp}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type={
                        selectedColumn.type === "number"
                          ? "number"
                          : selectedColumn.type === "date"
                          ? "date"
                          : "text"
                      }
                      value={valueInput}
                      onChange={(e) => setValueInput(e.target.value)}
                      placeholder="Enter value..."
                      className="flex-1 px-3 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleValueSubmit();
                      }}
                    />
                    <button
                      onClick={handleValueSubmit}
                      disabled={!valueInput}
                      className="px-3 py-1.5 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* No filters message */}
      {filters.length === 0 && !disabled && (
        <span className="text-xs text-[#A69DC0] italic">No filters applied</span>
      )}
    </div>
  );
}
