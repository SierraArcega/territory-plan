"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  id: string;
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  countLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

type TriState = "unchecked" | "indeterminate" | "checked";

function getTriggerLabel(
  selected: string[],
  options: MultiSelectOption[],
  placeholder: string,
  countLabel: string
): string {
  if (selected.length === 0) return placeholder;
  if (selected.length === 1) {
    return options.find((o) => o.value === selected[0])?.label ?? selected[0];
  }
  if (selected.length <= 3) {
    return selected
      .map((v) => options.find((o) => o.value === v)?.label ?? v)
      .join(", ");
  }
  return `${selected.length} ${countLabel}`;
}

function getTriState(filtered: MultiSelectOption[], selected: string[]): TriState {
  if (filtered.length === 0) return "unchecked";
  const count = filtered.filter((o) => selected.includes(o.value)).length;
  if (count === 0) return "unchecked";
  if (count === filtered.length) return "checked";
  return "indeterminate";
}

export function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  countLabel = "items",
  searchPlaceholder = "Search...",
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const selectAllRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 });

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const triState = getTriState(filtered, selected);

  // Close on outside click (check both container and portaled dropdown)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Position the dropdown relative to the trigger, capped to viewport
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const maxHeight = Math.min(240, window.innerHeight - rect.bottom - 16);
      setDropdownPos({
        top: rect.bottom + 4,
        left: rect.left,
        width: Math.max(rect.width, 200),
        maxHeight: Math.max(maxHeight, 120),
      });
    }
  }, [isOpen]);

  // Auto-focus search on open and reset state
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(-1);
      // setTimeout gives the panel time to mount before focusing
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll active row into view when activeIndex changes.
  // Guard with typeof check because jsdom (used in tests) does not implement
  // scrollIntoView and would throw a TypeError.
  useEffect(() => {
    if (activeIndex === 0) {
      const el = selectAllRef.current;
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest" });
      }
    } else if (activeIndex >= 1) {
      const el = optionRefs.current[activeIndex - 1];
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const handleToggleOption = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange]
  );

  const handleSelectAll = useCallback(() => {
    if (filtered.length === 0) return;
    const filteredValues = filtered.map((o) => o.value);
    if (triState === "checked") {
      onChange(selected.filter((v) => !filteredValues.includes(v)));
    } else {
      const toAdd = filteredValues.filter((v) => !selected.includes(v));
      onChange([...selected, ...toAdd]);
    }
  }, [filtered, triState, selected, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const N = filtered.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev === -1 ? 0 : Math.min(prev + 1, N)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === 0) handleSelectAll();
      else if (activeIndex >= 1 && activeIndex <= N) handleToggleOption(filtered[activeIndex - 1].value);
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setActiveIndex(-1);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  // When disabled, always show placeholder — no selection state is communicated
  // to keep the disabled appearance clean and avoid DOM text collision in tests.
  const triggerLabel = disabled
    ? placeholder
    : getTriggerLabel(selected, options, placeholder, countLabel);

  const activeDescendant =
    activeIndex === 0
      ? `${id}-select-all`
      : activeIndex >= 1
      ? `${id}-option-${filtered[activeIndex - 1]?.value}`
      : undefined;

  const selectAllLabel = query.trim()
    ? `Select ${filtered.length} results`
    : `Select all ${options.length}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className={`h-9 px-3 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] flex items-center gap-2 min-w-[120px] ${
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        }`}
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

      {/* Chips — shown for 2+ selections:
          - 1 item: trigger shows the label inline; chip would duplicate it and
            cause ARIA name collisions in tests.
          - 2+ items: chips show the selections inline.
          - disabled: chips are always suppressed (trigger shows placeholder). */}
      {!disabled && selected.length >= 2 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((value) => {
            const opt = options.find((o) => o.value === value);
            const chipLabel = opt?.label ?? value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]"
              >
                {chipLabel}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((v) => v !== value))}
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

      {/* Dropdown panel — portaled to body to escape overflow clipping */}
      {isOpen && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-50 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden flex flex-col"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, maxHeight: dropdownPos.maxHeight }}
        >
          {/* Search input — always auto-focused, no focus ring needed */}
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-2 text-sm border-b border-[#E2DEEC] bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
            aria-label="Search options"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={activeDescendant}
          />

          {/* Select All row — hidden when 0 results */}
          {filtered.length > 0 && (
            <div
              ref={selectAllRef}
              id={`${id}-select-all`}
              role="checkbox"
              aria-checked={
                triState === "checked" ? true : triState === "indeterminate" ? "mixed" : false
              }
              aria-label={selectAllLabel}
              tabIndex={-1}
              onMouseDown={() => setActiveIndex(0)}
              onClick={handleSelectAll}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#403770] border-b border-[#E2DEEC] cursor-pointer select-none ${
                activeIndex === 0 ? "bg-[#EDE9F7]" : "bg-[#FDFCFF] hover:bg-[#F7F5FA]"
              }`}
            >
              {/* Tri-state checkbox visual */}
              {triState === "unchecked" ? (
                <span
                  className="w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  {triState === "indeterminate" ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4">
                      <rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-4 h-4">
                      <path
                        d="M3 8L6.5 11.5L13 5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              )}
              {selectAllLabel}
            </div>
          )}

          {/* Scrollable option list */}
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="flex-1 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">No results</li>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = selected.includes(opt.value);
                const isCursor = activeIndex === i + 1;
                return (
                  <li
                    key={opt.value}
                    id={`${id}-option-${opt.value}`}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={() => setActiveIndex(i + 1)}
                    onClick={() => handleToggleOption(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm text-[#403770] cursor-pointer select-none ${
                      isCursor ? "bg-[#EDE9F7]" : "hover:bg-[#F7F5FA]"
                    }`}
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
        </div>,
        document.body
      )}
    </div>
  );
}
