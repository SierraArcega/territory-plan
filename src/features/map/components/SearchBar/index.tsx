"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";
import { searchLocations, type GeocodeSuggestion } from "@/features/map/lib/geocode";
import { mapV2Ref } from "@/features/map/lib/ref";
import GeographyDropdown from "./GeographyDropdown";
import FullmindDropdown from "./FullmindDropdown";
import CompetitorsDropdown from "./CompetitorsDropdown";
import FinanceDropdown from "./FinanceDropdown";
import DemographicsDropdown from "./DemographicsDropdown";
import AcademicsDropdown from "./AcademicsDropdown";
import FilterPills from "./FilterPills";
import { Settings } from 'lucide-react';

// Domain classification for badge counts
const DOMAIN_COLUMNS: Record<string, Set<string>> = {
  geography: new Set([
    "state", "urbanicity", "_zipRadius",
  ]),
  fullmind: new Set([
    "isCustomer", "hasOpenPipeline", "salesExecutive", "owner",
    "fy26_open_pipeline_value", "fy26_closed_won_net_booking", "fy26_net_invoicing",
    "planNames", "tags",
  ]),
  competitors: new Set([
    "competitor_proximity", "competitor_elevate", "competitor_tbt", "competitor_educere",
    "competitorEngagement", "competitorChurned",
  ]),
  finance: new Set([
    "expenditurePerPupil", "totalRevenue", "federalRevenue", "stateRevenue", "localRevenue",
    "techSpending", "titleIRevenue", "esserFundingTotal", "capitalOutlayTotal", "debtOutstanding",
  ]),
  demographics: new Set([
    "enrollment", "ell_percent", "sped_percent", "free_lunch_percent",
    "medianHouseholdIncome", "enrollmentTrend3yr",
  ]),
  academics: new Set([
    "graduationRate", "mathProficiency", "readProficiency", "chronicAbsenteeismRate",
    "studentTeacherRatio", "teachersFte", "spedExpenditurePerStudent",
  ]),
};

function getFilterDomain(column: string): string | null {
  for (const [domain, cols] of Object.entries(DOMAIN_COLUMNS)) {
    if (cols.has(column)) return domain;
  }
  return null;
}

function countByDomain(filters: ExploreFilter[], domain: string): number {
  return filters.filter((f) => getFilterDomain(f.column) === domain).length;
}

export default function SearchBar() {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const toggleLayerBubble = useMapV2Store((s) => s.toggleLayerBubble);

  // Location search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Dropdown state
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim() || value.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const results = await searchLocations(value);
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    }, 350);
  }, []);

  const handleSelectLocation = useCallback((suggestion: GeocodeSuggestion) => {
    setQuery(suggestion.displayName.split(",")[0]);
    setShowSuggestions(false);
    setSuggestions([]);
    const map = mapV2Ref.current;
    if (map) {
      map.flyTo({ center: [suggestion.lng, suggestion.lat], zoom: 10, duration: 1500 });
    }
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.closest(".search-bar-root")?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleDropdown = useCallback((name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  }, []);

  const activeFilterCount = searchFilters.length;

  return (
    <div className="search-bar-root shrink-0 relative z-20 flex flex-col">
      {/* Main bar */}
      <div className="flex items-center gap-2 bg-[#F7F5FA] border-b border-[#D4CFE2] px-3 py-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-[160px] max-w-[300px]">
          <div className="flex items-center gap-2 bg-white rounded-lg border border-[#C2BBD4] px-2.5 py-1.5 focus-within:border-plum focus-within:ring-2 focus-within:ring-plum/15 transition-all">
            <svg className="w-4 h-4 text-plum/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="Search districts, cities, ZIP..."
              className="w-full bg-transparent text-sm text-[#544A78] placeholder:text-[#8A80A8] focus:outline-none"
            />
            {query && (
              <button
                onClick={() => { setQuery(""); setSuggestions([]); setShowSuggestions(false); }}
                className="text-[#A69DC0] hover:text-[#6E6390]"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Location suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-lg border border-[#D4CFE2] overflow-hidden z-50">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSelectLocation(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFEDF5] transition-colors border-b border-[#E2DEEC] last:border-0"
                >
                  <span className="text-[#544A78]">{s.displayName.split(",")[0]}</span>
                  <span className="text-[#A69DC0] text-xs ml-1">
                    {s.displayName.split(",").slice(1).join(",").trim()}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#D4CFE2]" />

        {/* 6 domain filter buttons */}
        <div className="flex items-center gap-1">
          <DomainButton label="Geography" domain="geography" isOpen={openDropdown === "geography"} onClick={() => toggleDropdown("geography")} filters={searchFilters} />
          <DomainButton label="Fullmind" domain="fullmind" isOpen={openDropdown === "fullmind"} onClick={() => toggleDropdown("fullmind")} filters={searchFilters} />
          <DomainButton label="Competitors" domain="competitors" isOpen={openDropdown === "competitors"} onClick={() => toggleDropdown("competitors")} filters={searchFilters} />
          <DomainButton label="Finance" domain="finance" isOpen={openDropdown === "finance"} onClick={() => toggleDropdown("finance")} filters={searchFilters} />
          <DomainButton label="Demographics" domain="demographics" isOpen={openDropdown === "demographics"} onClick={() => toggleDropdown("demographics")} filters={searchFilters} />
          <DomainButton label="Academics" domain="academics" isOpen={openDropdown === "academics"} onClick={() => toggleDropdown("academics")} filters={searchFilters} />
        </div>

        {/* Clear filters */}
        {activeFilterCount > 0 && (
          <>
            <div className="w-px h-6 bg-[#D4CFE2]" />
            <button
              onClick={() => useMapV2Store.getState().clearSearchFilters()}
              className="text-xs text-coral hover:text-coral/80 font-semibold whitespace-nowrap"
            >
              Clear {activeFilterCount}
            </button>
          </>
        )}

        {/* Divider */}
        <div className="w-px h-6 bg-[#D4CFE2]" />

        {/* Gear icon for Layers */}
        <button
          onClick={() => { setOpenDropdown(null); toggleLayerBubble(); }}
          className="p-1.5 rounded-lg text-plum/50 hover:bg-white hover:text-plum transition-colors"
          title="Map Layers"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Active filter pills — in flow, part of toolbar */}
      {searchFilters.length > 0 && (
        <div className="bg-white border-b border-[#D4CFE2] px-3 py-1.5">
          <FilterPills />
        </div>
      )}

      {/* Dropdown panels — absolute overlay below toolbar */}
      {openDropdown && (
        <div className="absolute top-full left-0 z-50 px-3 pt-2">
          {openDropdown === "geography" && <GeographyDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "fullmind" && <FullmindDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "competitors" && <CompetitorsDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "finance" && <FinanceDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "demographics" && <DemographicsDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "academics" && <AcademicsDropdown onClose={() => setOpenDropdown(null)} />}
        </div>
      )}
    </div>
  );
}

function DomainButton({
  label,
  domain,
  isOpen,
  onClick,
  filters,
}: {
  label: string;
  domain: string;
  isOpen: boolean;
  onClick: () => void;
  filters: ExploreFilter[];
}) {
  const count = countByDomain(filters, domain);

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        isOpen
          ? "bg-plum text-white shadow-sm"
          : count > 0
            ? "bg-white text-plum border border-plum/20 shadow-sm hover:bg-plum/5"
            : "text-[#544A78] hover:bg-white hover:shadow-sm"
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`rounded-full text-[9px] font-bold flex items-center justify-center leading-none min-w-[16px] h-4 px-1 ${
          isOpen ? "bg-white/25 text-white" : "bg-coral text-white"
        }`}>
          {count}
        </span>
      )}
      <svg
        className={`w-2.5 h-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
