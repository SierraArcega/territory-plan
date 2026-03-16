"use client";

// AsyncMultiSelect — same visual UX as MultiSelect but options are loaded
// dynamically via an async onSearch callback instead of a static prop.
// Select-all is intentionally disabled because search results are a small
// slice of a large dataset — bulk-selecting them isn't the intended interaction.

import { useState, useRef, useEffect, useCallback } from "react";
import type { MultiSelectOption } from "./MultiSelect";

export interface AsyncMultiSelectProps {
  id: string;
  label: string;
  selected: string[];
  onChange: (values: string[]) => void;
  onSearch: (query: string) => Promise<MultiSelectOption[]>;
  placeholder?: string;
  countLabel?: string;
  searchPlaceholder?: string;
}

function getTriggerLabel(
  selected: string[],
  labelMap: Map<string, string>,
  placeholder: string,
  countLabel: string
): string {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) {
    return labelMap.get(selected[0]) ?? selected[0];
  }
  if (selected.length <= 3) {
    return selected.map((v) => labelMap.get(v) ?? v).join(", ");
  }
  return `${selected.length} ${countLabel}`;
}

export function AsyncMultiSelect({
  id,
  label,
  selected,
  onChange,
  onSearch,
  placeholder = "Search…",
  countLabel = "items",
  searchPlaceholder = "Type to search…",
}: AsyncMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MultiSelectOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  // labelMap accumulates value→label for every item that has ever been selected,
  // so chips and the trigger label resolve correctly even after results change.
  const [labelMap, setLabelMap] = useState<Map<string, string>>(new Map());

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Focus search input when dropdown opens, reset state.
  // No setTimeout here — jsdom handles focus synchronously and userEvent
  // hangs waiting for pending timers when a setTimeout(0) is left open.
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      setIsError(false);
      searchRef.current?.focus();
    }
  }, [isOpen]);

  // Cancel any pending debounce timer on unmount to avoid setState on unmounted component
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setIsError(false);
      try {
        const opts = await onSearch(q);
        setResults(opts);
      } catch {
        setResults([]);
        setIsError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [onSearch]
  );

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(value), 250);
  };

  const handleToggle = useCallback(
    (opt: MultiSelectOption) => {
      if (selected.includes(opt.value)) {
        // Deselect: remove from selected and from labelMap
        onChange(selected.filter((v) => v !== opt.value));
        setLabelMap((prev) => {
          const next = new Map(prev);
          next.delete(opt.value);
          return next;
        });
      } else {
        // Select: add to selected and accumulate label
        onChange([...selected, opt.value]);
        setLabelMap((prev) => new Map(prev).set(opt.value, opt.label));
      }
    },
    [selected, onChange]
  );

  const handleChipRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value));
    setLabelMap((prev) => {
      const next = new Map(prev);
      next.delete(value);
      return next;
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setResults([]);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const triggerLabel = getTriggerLabel(selected, labelMap, placeholder, countLabel);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="h-9 px-3 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] flex items-center gap-2 min-w-[120px]"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex-1 text-left">{triggerLabel}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-[#A69DC0] transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chips — shown for 2+ selections */}
      {selected.length >= 2 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((value) => {
            const chipLabel = labelMap.get(value) ?? value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]"
              >
                {chipLabel}
                <button
                  type="button"
                  onClick={() => handleChipRemove(value)}
                  className="text-[#A69DC0] hover:text-[#403770] transition-colors"
                  aria-label={`Remove ${chipLabel}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full min-w-[240px] bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden">
          {/* Search input */}
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-2 text-sm border-b border-[#E2DEEC] bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
            aria-label="Search options"
          />

          {/* Results list */}
          <ul
            role="listbox"
            aria-label={label}
            aria-multiselectable="true"
            className="max-h-60 overflow-y-auto"
          >
            {isLoading ? (
              <li className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-[#E2DEEC] border-t-[#403770] rounded-full animate-spin" />
              </li>
            ) : isError ? (
              <li className="px-3 py-2 text-sm text-[#F37167]">Search failed — try again</li>
            ) : query.length < 2 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">Type to search…</li>
            ) : results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">No results</li>
            ) : (
              results.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleToggle(opt)}
                    className="flex items-center gap-2 px-3 py-2 text-sm text-[#403770] cursor-pointer select-none hover:bg-[#F7F5FA]"
                  >
                    {isSelected ? (
                      <span
                        className="w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                        aria-hidden="true"
                      >
                        <svg viewBox="0 0 16 16" className="w-4 h-4">
                          <path
                            d="M3 8L6.5 11.5L13 5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

export default AsyncMultiSelect;
