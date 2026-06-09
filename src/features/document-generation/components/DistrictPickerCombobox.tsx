"use client";

import { useEffect, useRef, useState } from "react";
import { useDistrictNameSearch } from "@/features/plans/lib/queries";
import type { DistrictSearchResult } from "@/features/plans/lib/queries";

interface DistrictPickerComboboxProps {
  onSelect: (district: DistrictSearchResult) => void;
  placeholder?: string;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/**
 * Inline type-to-search district picker. Reuses the plans tab's
 * `useDistrictNameSearch` hook (backed by /api/districts/search) and fires
 * `onSelect` with the chosen district. Single-select; no plan-add logic.
 */
export default function DistrictPickerCombobox({
  onSelect,
  placeholder = "Search districts by name…",
}: DistrictPickerComboboxProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(query, 300);
  const { data: results, isLoading } = useDistrictNameSearch(debouncedQuery);

  const showDropdown = open && query.length >= 2;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSelect = (district: DistrictSearchResult) => {
    onSelect(district);
    setQuery(district.name);
    setOpen(false);
  };

  const listboxId = "district-picker-listbox";

  return (
    <div ref={containerRef} className="relative max-w-md">
      <div className="flex items-center gap-1.5 rounded-lg border border-[#C2BBD4] bg-white px-2.5 py-1.5 focus-within:border-[#403770]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#403770" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-label="Search districts by name"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm text-[#403770] placeholder:text-[#A69DC0] outline-none"
        />
      </div>

      {showDropdown && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[280px] overflow-y-auto rounded-xl border border-[#D4CFE2] bg-white shadow-lg"
        >
          {isLoading && (
            <li className="px-3 py-3 text-center">
              <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#D4CFE2] border-t-[#403770]" />
            </li>
          )}

          {!isLoading && (results?.length ?? 0) === 0 && (
            <li className="px-4 py-5 text-center text-sm text-[#8A80A8]">
              No districts matching &ldquo;{query}&rdquo;
            </li>
          )}

          {!isLoading &&
            results?.map((district) => (
              <li
                key={district.leaid}
                role="option"
                aria-selected={false}
                className="flex cursor-pointer items-center gap-2 border-b border-[#F7F5FA] px-3 py-2.5 last:border-0 hover:bg-[#F7F5FA]"
                onClick={() => handleSelect(district)}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-[#403770]">{district.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#A69DC0]">
                    {district.stateAbbrev || "—"}
                    <> &middot; {district.leaid}</>
                    {district.enrollment != null && <> &middot; {district.enrollment.toLocaleString()} enrolled</>}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
