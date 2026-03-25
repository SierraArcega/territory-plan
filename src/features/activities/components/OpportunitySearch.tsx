"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X, ExternalLink } from "lucide-react";
import { useOpportunitySearch } from "@/features/activities/lib/queries";
import type { OpportunityResult } from "@/features/activities/lib/outcome-types-api";

export type { OpportunityResult };

interface OpportunitySearchProps {
  value: OpportunityResult[];
  onChange: (opps: OpportunityResult[]) => void;
  disabled?: boolean;
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function OpportunitySearch({
  value,
  onChange,
  disabled = false,
}: OpportunitySearchProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounce input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results
  const { data: results, isLoading } = useOpportunitySearch(debouncedQuery);

  // Show dropdown when we have a debounced query
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setShowDropdown(true);
    } else {
      setShowDropdown(false);
    }
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = new Set(value.map((o) => o.id));

  const handleSelect = useCallback(
    (opp: OpportunityResult) => {
      if (!selectedIds.has(opp.id)) {
        onChange([...value, opp]);
      }
      setQuery("");
      setDebouncedQuery("");
      setShowDropdown(false);
    },
    [onChange, value, selectedIds]
  );

  const handleRemove = useCallback(
    (oppId: string) => {
      onChange(value.filter((o) => o.id !== oppId));
    },
    [onChange, value]
  );

  // Filter out already-selected opps from dropdown
  const filteredResults = results?.filter((opp) => !selectedIds.has(opp.id));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
          Link Opportunities
        </p>
        <a
          href="https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
        >
          Create new <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Selected opportunities */}
      {value.length > 0 && (
        <div className="space-y-1.5 mb-2">
          {value.map((opp) => (
            <div
              key={opp.id}
              className="border border-[#E2DEEC] rounded-lg p-2.5 bg-[#F7F5FA]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#403770] truncate">{opp.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[10px] text-[#A69DC0]">{opp.id}</span>
                    {opp.stage && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEEAF5] text-[#403770]">
                        {opp.stage}
                      </span>
                    )}
                    {opp.netBookingAmount !== null && (
                      <span className="text-xs font-medium text-[#544A78]">
                        {formatCurrency(opp.netBookingAmount)}
                      </span>
                    )}
                    {opp.districtName && (
                      <span className="text-xs text-[#8A80A8] truncate">
                        {opp.districtName}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemove(opp.id)}
                  disabled={disabled}
                  className="p-1 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors cursor-pointer shrink-0"
                  aria-label={`Remove ${opp.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search input — always visible */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={value.length > 0 ? "Link another opportunity..." : "Search by opportunity name or ID..."}
          disabled={disabled}
          className="w-full pl-8 pr-3 py-2 text-sm font-medium border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white text-[#403770] placeholder:text-[#A69DC0]"
        />
        {isLoading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#A69DC0] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {(!filteredResults || filteredResults.length === 0) && !isLoading ? (
            <div className="px-3 py-3 text-sm text-[#A69DC0] italic">
              No opportunities found
            </div>
          ) : (
            filteredResults?.map((opp) => (
              <button
                key={opp.id}
                type="button"
                onClick={() => handleSelect(opp)}
                className="w-full text-left px-3 py-2.5 hover:bg-[#F7F5FA] transition-colors cursor-pointer border-b border-[#E2DEEC] last:border-b-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-[#403770] truncate">{opp.name}</span>
                  {opp.stage && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEEAF5] text-[#403770] shrink-0">
                      {opp.stage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {opp.netBookingAmount !== null && (
                    <span className="text-xs font-medium text-[#544A78]">
                      {formatCurrency(opp.netBookingAmount)}
                    </span>
                  )}
                  {opp.districtName && (
                    <span className="text-xs text-[#8A80A8] truncate">{opp.districtName}</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
