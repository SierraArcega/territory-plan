"use client";

import { useState, useRef, useEffect } from "react";
import type { ColumnSchema } from "../lib/types";

interface ColumnPickerProps {
  availableColumns: ColumnSchema[];
  selectedColumns: string[];
  onChange: (columns: string[]) => void;
  disabled: boolean;
}

export default function ColumnPicker({
  availableColumns,
  selectedColumns,
  onChange,
  disabled,
}: ColumnPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const removeColumn = (key: string) => {
    onChange(selectedColumns.filter((c) => c !== key));
  };

  const addColumn = (key: string) => {
    if (!selectedColumns.includes(key)) {
      onChange([...selectedColumns, key]);
    }
    setSearch("");
    setIsOpen(false);
  };

  // Columns available for adding (not already selected)
  const unselectedColumns = availableColumns.filter(
    (c) => !selectedColumns.includes(c.key)
  );

  // Filter by search
  const filteredColumns = search
    ? unselectedColumns.filter(
        (c) =>
          c.label.toLowerCase().includes(search.toLowerCase()) ||
          c.key.toLowerCase().includes(search.toLowerCase())
      )
    : unselectedColumns;

  // Look up label for a selected column key
  const getLabel = (key: string) => {
    return availableColumns.find((c) => c.key === key)?.label ?? key;
  };

  return (
    <div className="flex items-center gap-2 flex-wrap min-h-[36px]">
      <span className="text-xs font-semibold uppercase tracking-wider text-[#8A80A8] flex-shrink-0">
        Columns
      </span>

      {/* Selected column pills */}
      {selectedColumns.map((key) => (
        <span
          key={key}
          className="inline-flex items-center gap-1 px-2.5 py-1 bg-[#F7F5FA] border border-[#D4CFE2] rounded-full text-xs font-medium text-[#544A78]"
        >
          {getLabel(key)}
          <button
            onClick={() => removeColumn(key)}
            className="flex items-center justify-center w-3.5 h-3.5 rounded-full hover:bg-[#D4CFE2] transition-colors text-[#8A80A8] hover:text-[#403770]"
            aria-label={`Remove ${getLabel(key)}`}
          >
            <svg
              className="w-2.5 h-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </span>
      ))}

      {/* Add column button + dropdown */}
      {!disabled && (
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={disabled || unselectedColumns.length === 0}
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
            Column
          </button>

          {isOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg z-30 overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-[#E2DEEC]">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search columns..."
                  className="w-full px-3 py-1.5 text-sm text-[#403770] bg-[#F7F5FA] border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
                  autoFocus
                />
              </div>

              {/* Options */}
              <div className="max-h-60 overflow-y-auto py-1">
                {filteredColumns.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-[#A69DC0]">
                    {search
                      ? "No matching columns"
                      : "All columns selected"}
                  </div>
                ) : (
                  filteredColumns.map((col) => (
                    <button
                      key={col.key}
                      onClick={() => addColumn(col.key)}
                      className="w-full text-left px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100 flex items-center justify-between"
                    >
                      <span>{col.label}</span>
                      <span className="text-[10px] font-medium text-[#A69DC0] uppercase tracking-wider">
                        {col.type}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Prompt when no columns selected */}
      {selectedColumns.length === 0 && !disabled && (
        <span className="text-xs text-[#A69DC0] italic">
          Select columns to display
        </span>
      )}
    </div>
  );
}
