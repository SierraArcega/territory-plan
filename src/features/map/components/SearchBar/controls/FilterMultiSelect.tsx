"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";

interface FilterMultiSelectProps {
  label: string;
  column: string;
  options: Array<{ value: string; label: string }>;
  onApply: (column: string, values: string[]) => void;
}

export default function FilterMultiSelect({ label, column, options, onApply }: FilterMultiSelectProps) {
  // Read existing filter values for this column from the store
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const removeSearchFilter = useMapV2Store((s) => s.removeSearchFilter);
  const existingFilter = searchFilters.find((f) => f.column === column && f.op === "in");
  const existingValues = existingFilter && Array.isArray(existingFilter.value)
    ? (existingFilter.value as unknown[]).map((v) =>
        typeof v === "string" ? v : JSON.stringify(v)
      )
    : [];

  const [selected, setSelected] = useState<Set<string>>(new Set(existingValues));
  const [search, setSearch] = useState("");

  // Sync selected state when existing filter changes externally (e.g. cleared from pills)
  useEffect(() => {
    setSelected(new Set(existingValues));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingFilter?.id]);
  const [activeIndex, setActiveIndex] = useState(-1); // -1=none, 0=selectAll, 1..N=options
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter options by search query
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, search]);

  // Auto-focus search on mount
  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  // Apply the current selection to the store immediately — remove the existing filter
  // for this column (if any) then add a new one if the selection is non-empty.
  const applyNow = (next: Set<string>) => {
    const current = useMapV2Store.getState().searchFilters.find((f) => f.column === column);
    if (current) removeSearchFilter(current.id);
    if (next.size > 0) onApply(column, [...next]);
  };

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setSelected(next);
    applyNow(next);
  };

  const selectAll = () => {
    const allFiltered = filtered.map((o) => o.value);
    const allSelected = allFiltered.every((v) => selected.has(v));
    const next = new Set(selected);
    if (allSelected) {
      for (const v of allFiltered) next.delete(v);
    } else {
      for (const v of allFiltered) next.add(v);
    }
    setSelected(next);
    applyNow(next);
  };

  const removeAll = () => {
    setSelected(new Set());
    applyNow(new Set());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length)); // 0=selectAll, 1..N=items
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === 0) {
        selectAll();
      } else if (activeIndex > 0 && filtered[activeIndex - 1]) {
        toggle(filtered[activeIndex - 1].value);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (search) {
        setSearch("");
        setActiveIndex(-1);
      }
    }
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((o) => selected.has(o.value));
  const someFilteredSelected = filtered.some((o) => selected.has(o.value)) && !allFilteredSelected;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-[#8A80A8]">{label}</label>
        {(selected.size > 0 || existingFilter) && (
          <button
            onClick={removeAll}
            className="text-[10px] font-medium text-[#A69DC0] hover:text-[#6E6390] transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="border border-[#D4CFE2] rounded-lg overflow-hidden">
        <div className="px-2 pt-2 pb-1 border-b border-[#E2DEEC]">
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setActiveIndex(-1); }}
            onKeyDown={handleKeyDown}
            placeholder={`Search ${label.toLowerCase()}...`}
            className="w-full text-xs px-1.5 py-1 rounded border border-[#D4CFE2] focus:outline-none focus:ring-1 focus:ring-plum/30 placeholder:text-[#A69DC0]"
            role="combobox"
            aria-expanded="true"
            aria-controls="multiselect-listbox"
            aria-activedescendant={
              activeIndex === 0
                ? "multiselect-select-all"
                : activeIndex > 0 && filtered[activeIndex - 1]
                ? `multiselect-option-${filtered[activeIndex - 1].value}`
                : undefined
            }
          />
        </div>

        {/* Selected values pills */}
        {selected.size > 0 && (
          <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-[#E2DEEC] bg-[#F7F5FA]">
            {[...selected].map((val) => {
              const opt = options.find((o) => o.value === val);
              return (
                <span
                  key={val}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-plum/10 text-plum text-[10px] font-medium"
                >
                  {opt?.label?.split("(")[0]?.trim() || val}
                  <button
                    onClick={(e) => { e.stopPropagation(); toggle(val); }}
                    className="hover:text-plum/60 transition-colors"
                  >
                    ×
                  </button>
                </span>
              );
            })}
          </div>
        )}

        {/* Options list */}
        <div ref={listRef} className="max-h-36 overflow-y-auto" role="listbox" id="multiselect-listbox">
          {/* Select All / Remove All */}
          <button
            id="multiselect-select-all"
            role="option"
            aria-selected={allFilteredSelected}
            onClick={selectAll}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-left transition-colors border-b border-[#E2DEEC] ${
              activeIndex === 0 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
            }`}
          >
            <input
              type="checkbox"
              checked={allFilteredSelected}
              ref={(el) => { if (el) el.indeterminate = someFilteredSelected; }}
              onChange={selectAll}
              className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
              tabIndex={-1}
            />
            <span className="text-xs font-medium text-[#6E6390]">
              {allFilteredSelected ? "Deselect All" : "Select All"}
              {search && ` (${filtered.length})`}
            </span>
          </button>

          {/* Filtered options */}
          {filtered.length === 0 && (
            <div className="px-2.5 py-2 text-xs text-[#A69DC0] italic">
              No matches for &ldquo;{search}&rdquo;
            </div>
          )}
          {filtered.map((o, i) => (
            <button
              key={o.value}
              id={`multiselect-option-${o.value}`}
              role="option"
              aria-selected={selected.has(o.value)}
              ref={(el) => {
                if (i === activeIndex - 1 && el) {
                  el.scrollIntoView({ block: "nearest" });
                }
              }}
              onClick={() => toggle(o.value)}
              className={`w-full flex items-center gap-2 px-2.5 py-1 text-left cursor-pointer transition-colors ${
                activeIndex === i + 1 ? "bg-plum/10" : "hover:bg-[#EFEDF5]"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(o.value)}
                onChange={() => toggle(o.value)}
                className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
                tabIndex={-1}
              />
              <span className={`text-xs ${selected.has(o.value) ? "text-[#544A78] font-medium" : "text-[#544A78]"}`}>
                {o.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
