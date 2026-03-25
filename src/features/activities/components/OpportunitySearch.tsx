"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { useOpportunitySearch } from "@/features/activities/lib/queries";
import type { OpportunityResult } from "@/features/activities/lib/outcome-types-api";

export type { OpportunityResult };

interface OpportunitySearchProps {
  value: OpportunityResult | null;
  onChange: (opp: OpportunityResult | null) => void;
  disabled?: boolean;
}

const labelStyle =
  "block text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1.5";

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

  const handleSelect = useCallback(
    (opp: OpportunityResult) => {
      onChange(opp);
      setQuery("");
      setDebouncedQuery("");
      setShowDropdown(false);
    },
    [onChange]
  );

  const handleRemove = useCallback(() => {
    onChange(null);
  }, [onChange]);

  // If an opportunity is selected, show the preview card
  if (value) {
    return (
      <div>
        <p className={labelStyle}>Link Opportunity</p>
        <div className="border border-[#E2DEEC] rounded-lg p-3 bg-[#F7F5FA]">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#403770] truncate">{value.name}</p>
              <p className="text-xs text-[#8A80A8] mt-0.5 truncate">{value.id}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {value.stage && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#EEEAF5] text-[#403770]">
                    {value.stage}
                  </span>
                )}
                {value.netBookingAmount !== null && (
                  <span className="text-xs font-medium text-[#544A78]">
                    {formatCurrency(value.netBookingAmount)}
                  </span>
                )}
                {value.districtName && (
                  <span className="text-xs text-[#8A80A8] truncate">
                    {value.districtName}
                  </span>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleRemove}
              disabled={disabled}
              className="p-1 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors cursor-pointer shrink-0"
              aria-label="Remove linked opportunity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Search input mode
  return (
    <div ref={containerRef} className="relative">
      <p className={labelStyle}>Link Opportunity</p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by opportunity name or ID..."
          disabled={disabled}
          className="w-full pl-8 pr-3 py-2 text-sm font-medium border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-coral/30 focus:border-coral bg-white text-[#403770] placeholder:text-[#A69DC0]"
        />
        {isLoading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#A69DC0] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {(!results || results.length === 0) && !isLoading ? (
            <div className="px-3 py-3 text-sm text-[#A69DC0] italic">
              No opportunities found
            </div>
          ) : (
            results?.map((opp) => (
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
