"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { ColumnDef } from "@/features/shared/components/DataGrid/types";
import type { FilterRule } from "@/features/shared/components/DataGrid/types";

// ---------------------------------------------------------------------------
// Normalization helper
// ---------------------------------------------------------------------------

function normalizeEnumValues(
  values: Array<string | { value: string; label: string }> | undefined
): { value: string; label: string }[] {
  if (!values) return [];
  return values.map((v) => (typeof v === "string" ? { value: v, label: v } : v));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminFilterBarProps {
  columnDefs: ColumnDef[];
  filters: FilterRule[];
  onAddFilter: (filter: FilterRule) => void;
  onRemoveFilter: (index: number) => void;
  onUpdateFilter: (index: number, filter: FilterRule) => void;
}

// ---------------------------------------------------------------------------
// Operators by column type
// ---------------------------------------------------------------------------

const OPERATORS_BY_TYPE: Record<string, { op: string; label: string; needsValue: boolean }[]> = {
  text: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
    { op: "contains", label: "contains", needsValue: true },
    { op: "is_empty", label: "is empty", needsValue: false },
    { op: "is_not_empty", label: "is not empty", needsValue: false },
  ],
  enum: [
    { op: "eq", label: "is", needsValue: true },
    { op: "neq", label: "is not", needsValue: true },
  ],
  number: [
    { op: "eq", label: "is", needsValue: true },
    { op: "gt", label: "greater than", needsValue: true },
    { op: "lt", label: "less than", needsValue: true },
  ],
  boolean: [
    { op: "is_true", label: "is true", needsValue: false },
    { op: "is_false", label: "is false", needsValue: false },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getColumnDef(columnDefs: ColumnDef[], key: string) {
  return columnDefs.find((c) => c.key === key);
}

function getOperators(filterType: string) {
  return OPERATORS_BY_TYPE[filterType] ?? OPERATORS_BY_TYPE.text;
}

function formatFilterLabel(columnDefs: ColumnDef[], filter: FilterRule): string {
  const col = getColumnDef(columnDefs, filter.column);
  const label = col?.label ?? filter.column;
  const operators = getOperators(col?.filterType ?? "text");
  const opDef = operators.find((o) => o.op === filter.operator);
  const opLabel = opDef?.label ?? filter.operator;
  if (opDef && !opDef.needsValue) {
    return `${label} ${opLabel}`;
  }
  // For enum columns with object-form values, render the human label, not the raw id.
  let displayValue: string = String(filter.value);
  if (col?.filterType === "enum" && col.enumValues) {
    const match = normalizeEnumValues(col.enumValues).find(
      (v) => v.value === String(filter.value)
    );
    if (match) displayValue = match.label;
  }
  return `${label} ${opLabel} "${displayValue}"`;
}

// ---------------------------------------------------------------------------
// Custom Dropdown (replaces native <select> for consistent styling)
// ---------------------------------------------------------------------------

function Dropdown({
  value,
  options,
  placeholder,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999, width: 0 });

  const selectedLabel = options.find((o) => o.value === value)?.label;

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => isOpen ? setIsOpen(false) : openDropdown()}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full px-3 pr-8 py-1.5 text-sm text-left border border-[#C2BBD4] rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent transition-colors ${
          value ? "text-[#403770]" : "text-[#A69DC0]"
        }`}
      >
        {selectedLabel ?? placeholder}
      </button>
      <svg
        className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
      {isOpen && createPortal(
        <ul
          ref={listRef}
          role="listbox"
          onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[9999] bg-white rounded-xl shadow-xl border border-[#D4CFE2] max-h-60 overflow-y-auto py-1"
          style={{ top: pos.top, left: pos.left, width: Math.max(pos.width, 180) }}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                className={`px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#F7F5FA] font-medium text-[#403770]"
                    : "text-[#403770] hover:bg-[#EFEDF5]"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminFilterBar({
  columnDefs,
  filters,
  onAddFilter,
  onRemoveFilter,
}: AdminFilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [filterValue, setFilterValue] = useState<string>("");
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

  // Reset form when popover opens
  useEffect(() => {
    if (isOpen) {
      setSelectedColumn("");
      setSelectedOperator("");
      setFilterValue("");
    }
  }, [isOpen]);

  // Derive operators from selected column
  const colDef = selectedColumn ? getColumnDef(columnDefs, selectedColumn) : null;
  const operators = colDef ? getOperators(colDef.filterType) : [];
  const currentOp = operators.find((o) => o.op === selectedOperator);

  // Auto-select first operator when column changes
  useEffect(() => {
    if (operators.length > 0 && !operators.find((o) => o.op === selectedOperator)) {
      setSelectedOperator(operators[0].op);
    }
  }, [selectedColumn, operators, selectedOperator]);

  const filterableColumns = columnDefs.filter(
    (c) => c.filterType && OPERATORS_BY_TYPE[c.filterType]
  );

  const handleApply = useCallback(() => {
    if (!selectedColumn || !selectedOperator) return;
    const needsValue = currentOp?.needsValue ?? true;
    if (needsValue && !filterValue) return;

    let value: string | number | boolean = filterValue;
    if (colDef?.filterType === "number" && filterValue) {
      value = parseFloat(filterValue);
    }
    if (colDef?.filterType === "boolean") {
      value = selectedOperator === "is_true";
    }

    onAddFilter({ column: selectedColumn, operator: selectedOperator, value });
    setIsOpen(false);
  }, [selectedColumn, selectedOperator, currentOp, filterValue, colDef, onAddFilter]);

  return (
    <div className="flex items-center gap-2 flex-wrap relative">
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
            d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
          />
        </svg>
        Filter
        {filters.length > 0 && (
          <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-[#403770] text-white rounded-full">
            {filters.length}
          </span>
        )}
      </button>

      {/* Active filter pills */}
      {filters.map((filter, i) => (
        <span
          key={`${filter.column}-${filter.operator}-${i}`}
          className="bg-[#EFEDF5] text-[#403770] text-xs font-medium rounded-full px-2.5 py-1 flex items-center gap-1.5"
        >
          {formatFilterLabel(columnDefs, filter)}
          <button
            onClick={() => onRemoveFilter(i)}
            className="text-[#8A80A8] hover:text-[#403770] transition-colors"
            aria-label="Remove filter"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </span>
      ))}

      {/* Popover */}
      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute top-full left-0 mt-1 z-30 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg p-3 w-80"
        >
          <div className="space-y-2">
            {/* Column select */}
            <div>
              <label className="text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider">
                Column
              </label>
              <div className="relative mt-1">
                <Dropdown
                  value={selectedColumn}
                  placeholder="Select column..."
                  options={filterableColumns.map((col) => ({ value: col.key, label: col.label }))}
                  onChange={(v) => {
                    setSelectedColumn(v);
                    setSelectedOperator("");
                    setFilterValue("");
                  }}
                />
              </div>
            </div>

            {/* Operator select */}
            {selectedColumn && (
              <div>
                <label className="text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider">
                  Operator
                </label>
                <div className="relative mt-1">
                  <Dropdown
                    value={selectedOperator}
                    placeholder="Select operator..."
                    options={operators.map((op) => ({ value: op.op, label: op.label }))}
                    onChange={(v) => {
                      setSelectedOperator(v);
                      setFilterValue("");
                    }}
                  />
                </div>
              </div>
            )}

            {/* Value input */}
            {selectedColumn && currentOp?.needsValue && (
              <div>
                <label className="text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider">
                  Value
                </label>
                {colDef?.filterType === "enum" && colDef.enumValues ? (
                  <div className="relative mt-1">
                    <Dropdown
                      value={filterValue}
                      placeholder="Select value..."
                      options={normalizeEnumValues(colDef.enumValues)}
                      onChange={setFilterValue}
                    />
                  </div>
                ) : colDef?.filterType === "number" ? (
                  <input
                    type="number"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Enter value..."
                    className="mt-1 w-full border border-[#C2BBD4] rounded-lg text-sm text-[#403770] px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
                  />
                ) : (
                  <input
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder="Enter value..."
                    className="mt-1 w-full border border-[#C2BBD4] rounded-lg text-sm text-[#403770] px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
                  />
                )}
              </div>
            )}

            {/* Apply button */}
            {selectedColumn && selectedOperator && (
              <button
                onClick={handleApply}
                disabled={currentOp?.needsValue && !filterValue}
                className="w-full mt-1 px-3 py-1.5 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Filter
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
