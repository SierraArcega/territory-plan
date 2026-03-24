"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useDistrictNameSearch, useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import type { DistrictSearchResult } from "@/features/plans/lib/queries";

interface AddDistrictComboboxProps {
  planId: string;
  existingLeaids: Set<string>;
  onAdded?: (leaid: string) => void;
  onError?: (message: string) => void;
}

function useDebounce(value: string, delay: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function AddDistrictCombobox({
  planId,
  existingLeaids,
  onAdded,
  onError,
}: AddDistrictComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 300);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);

  const { data: results, isLoading } = useDistrictNameSearch(debouncedQuery);
  const addMutation = useAddDistrictsToPlan();

  // Filter out already-added districts for clickability, but keep them visible
  const selectableResults = useMemo(() => {
    if (!results) return [];
    return results.map((r) => ({
      ...r,
      isInPlan: existingLeaids.has(r.leaid) || recentlyAdded.has(r.leaid),
    }));
  }, [results, existingLeaids, recentlyAdded]);

  const selectableIndexes = useMemo(
    () => selectableResults
      .map((r, i) => (r.isInPlan ? -1 : i))
      .filter((i) => i >= 0),
    [selectableResults]
  );

  const handleOpen = useCallback(() => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(-1);
    // Focus input on next tick
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  }, []);

  const handleAdd = useCallback(
    (district: DistrictSearchResult) => {
      if (existingLeaids.has(district.leaid) || recentlyAdded.has(district.leaid)) return;

      setRecentlyAdded((prev) => new Set(prev).add(district.leaid));

      addMutation.mutate(
        {
          planId,
          leaids: [district.leaid],
          districtData: {
            leaid: district.leaid,
            name: district.name,
            stateAbbrev: district.stateAbbrev,
            enrollment: district.enrollment,
            owner: district.owner,
          },
        },
        {
          onError: () => {
            setRecentlyAdded((prev) => {
              const next = new Set(prev);
              next.delete(district.leaid);
              return next;
            });
            const msg = `Failed to add ${district.name}`;
            setErrorMsg(msg);
            onError?.(msg);
            setTimeout(() => setErrorMsg(null), 3000);
          },
        }
      );

      onAdded?.(district.leaid);
      setQuery("");
      setActiveIndex(-1);
      inputRef.current?.focus();
    },
    [planId, existingLeaids, recentlyAdded, addMutation, onAdded, onError]
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, handleClose]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
        return;
      }

      if (!selectableResults.length) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const currentPos = selectableIndexes.indexOf(prev);
          const nextPos = currentPos < selectableIndexes.length - 1 ? currentPos + 1 : 0;
          return selectableIndexes[nextPos] ?? -1;
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => {
          const currentPos = selectableIndexes.indexOf(prev);
          const nextPos = currentPos > 0 ? currentPos - 1 : selectableIndexes.length - 1;
          return selectableIndexes[nextPos] ?? -1;
        });
      } else if (e.key === "Enter" && activeIndex >= 0) {
        e.preventDefault();
        const result = selectableResults[activeIndex];
        if (result && !result.isInPlan) {
          handleAdd(result);
        }
      }
    },
    [selectableResults, selectableIndexes, activeIndex, handleAdd, handleClose]
  );

  const listboxId = "add-district-listbox";
  const showDropdown = isOpen && query.length >= 2;

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#403770] bg-transparent border border-dashed border-[#403770]/25 rounded-lg hover:bg-[#403770]/5 hover:border-[#403770]/40 transition-colors"
        aria-label="Add district"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 1v10M1 6h10" />
        </svg>
        Add District
      </button>
    );
  }

  return (
    <div ref={containerRef} className="relative" style={{ width: 320 }}>
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-2 border-[#403770] rounded-lg bg-white shadow-[0_0_0_3px_rgba(64,55,112,0.08)]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#403770" strokeWidth="2" className="shrink-0">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded={showDropdown}
          aria-controls={listboxId}
          aria-activedescendant={activeIndex >= 0 ? `district-option-${activeIndex}` : undefined}
          aria-label="Search districts to add"
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search districts by name..."
          className="flex-1 text-sm text-[#403770] placeholder:text-[#A69DC0] bg-transparent outline-none"
        />
        <kbd className="text-[10px] text-[#A69DC0] bg-[#F7F5FA] px-1.5 py-0.5 rounded">ESC</kbd>
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden max-h-[280px] overflow-y-auto"
        >
          {isLoading && (
            <li className="px-3 py-3 text-center">
              <div className="inline-block w-4 h-4 border-2 border-[#D4CFE2] border-t-[#403770] rounded-full animate-spin" />
            </li>
          )}

          {!isLoading && selectableResults.length === 0 && (
            <li className="px-4 py-5 text-center">
              <div className="text-sm text-[#8A80A8]">
                No districts matching &ldquo;{query}&rdquo;
              </div>
              <div className="text-xs text-[#A69DC0] mt-1">
                Try a different name or use the map to browse
              </div>
            </li>
          )}

          {!isLoading && selectableResults.length > 0 && (
            <>
              <li className="px-3 py-1.5 text-[10px] font-semibold text-[#A69DC0] uppercase tracking-wider border-b border-[#E2DEEC]">
                {selectableResults.length} result{selectableResults.length !== 1 ? "s" : ""}
              </li>
              {selectableResults.map((district, index) => {
                const isActive = index === activeIndex;
                return (
                  <li
                    key={district.leaid}
                    id={`district-option-${index}`}
                    role="option"
                    aria-selected={isActive}
                    aria-disabled={district.isInPlan}
                    className={`flex items-center px-3 py-2.5 border-b border-[#F7F5FA] last:border-0 ${
                      district.isInPlan
                        ? "opacity-50 cursor-default"
                        : isActive
                          ? "bg-[#F7F5FA] cursor-pointer"
                          : "hover:bg-[#F7F5FA] cursor-pointer"
                    }`}
                    onClick={() => {
                      if (!district.isInPlan) handleAdd(district);
                    }}
                    onMouseEnter={() => {
                      if (!district.isInPlan) setActiveIndex(index);
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[#403770] truncate">
                        {highlightMatch(district.name, query)}
                      </div>
                      <div className="text-[11px] text-[#A69DC0] mt-0.5">
                        {district.stateAbbrev || "\u2014"}
                        {district.enrollment != null && (
                          <> &middot; {district.enrollment.toLocaleString()} enrolled</>
                        )}
                      </div>
                    </div>
                    {district.isInPlan ? (
                      <span className="text-[10px] font-medium text-[#F37167] bg-[#F37167]/8 px-2 py-0.5 rounded-full shrink-0">
                        In this plan
                      </span>
                    ) : district.accountType ? (
                      <AccountBadge accountType={district.accountType} />
                    ) : null}
                  </li>
                );
              })}
            </>
          )}
        </ul>
      )}

      {/* Error toast */}
      {errorMsg && (
        <div className="absolute top-full left-0 right-0 mt-1 px-3 py-2 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-xs text-[#F37167] font-medium z-50">
          {errorMsg}
        </div>
      )}
    </div>
  );
}

function AccountBadge({ accountType }: { accountType: string }) {
  const isCustomer = accountType === "Customer";
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
        isCustomer
          ? "text-[#6EA3BE] bg-[#6EA3BE]/10"
          : "text-[#8A80A8] bg-[#F7F5FA]"
      }`}
    >
      {accountType}
    </span>
  );
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="bg-[#403770]/10 rounded-sm px-px">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}
