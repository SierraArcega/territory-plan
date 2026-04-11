"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useMapV2Store, type ExploreFilter, type FiscalYear, type ContactLayerFilter, type VacancyLayerFilter, type ActivityLayerFilter, type PlanLayerFilter, type DateRange, type OverlayLayerType } from "@/features/map/lib/store";
import { searchLocations, type GeocodeSuggestion } from "@/features/map/lib/geocode";
import { mapV2Ref } from "@/features/map/lib/ref";
import type { LayerType } from "@/features/map/lib/layers";
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
} from "@/features/map/lib/filter-utils";
import { useGeographyPrefetch } from "@/features/map/lib/queries";

interface DistrictSuggestion {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  cityLocation?: string | null;
}
import { Info } from "lucide-react";
import GeographyDropdown from "./GeographyDropdown";
import DistrictsDropdown from "./DistrictsDropdown";
import ContactsDropdown from "./ContactsDropdown";
import VacanciesDropdown from "./VacanciesDropdown";
import ActivitiesDropdown from "./ActivitiesDropdown";
import PlansDropdown from "./PlansDropdown";
import FilterPills from "./FilterPills";

/** Count active filters for a contacts layer filter */
function countContactFilters(f: ContactLayerFilter): number {
  let n = 0;
  if (f.seniorityLevel?.length) n++;
  if (f.persona?.length) n++;
  if (f.primaryOnly) n++;
  return n;
}

/** Count active filters for a vacancies layer filter */
function countVacancyFilters(f: VacancyLayerFilter, dr: DateRange): number {
  let n = 0;
  if (f.category?.length) n++;
  if (f.status?.length) n++;
  if (f.fullmindRelevant) n++;
  if (f.minDaysOpen != null && f.minDaysOpen > 0) n++;
  if (f.maxDaysOpen != null && f.maxDaysOpen < 365) n++;
  if (dr.preset || dr.start || dr.end) n++;
  return n;
}

/** Count active filters for an activities layer filter */
function countActivityFilters(f: ActivityLayerFilter, dr: DateRange): number {
  let n = 0;
  if (f.type?.length) n++;
  if (f.status?.length) n++;
  if (f.outcome?.length) n++;
  if (dr.preset || dr.start || dr.end) n++;
  return n;
}

/** Count active filters for a plans layer filter */
function countPlanFilters(f: PlanLayerFilter): number {
  let n = 0;
  if (f.status?.length) n++;
  if (f.fiscalYear != null) n++;
  if (f.ownerScope === "all") n++;
  if (f.planIds?.length) n++;
  if (f.ownerIds?.length) n++;
  return n;
}

// Domain classification for badge counts
const DOMAIN_COLUMNS: Record<string, Set<string>> = {
  geography: new Set([
    "state", "countyName", "urbanicity", "_zipRadius", "charterSchoolCount", "titleISchoolCount",
  ]),
  fullmind: new Set([
    "isCustomer", "hasOpenPipeline", "salesExecutive", "owner",
    "open_pipeline", "closed_won_bookings", "invoicing",
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
  useGeographyPrefetch();
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const setSelectedFiscalYear = useMapV2Store((s) => s.setSelectedFiscalYear);
  const compareMode = useMapV2Store((s) => s.compareMode);
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);
  const enterCompareMode = useMapV2Store((s) => s.enterCompareMode);
  const exitCompareMode = useMapV2Store((s) => s.exitCompareMode);
  const setCompareFyA = useMapV2Store((s) => s.setCompareFyA);
  const setCompareFyB = useMapV2Store((s) => s.setCompareFyB);

  // Overlay layers
  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const toggleLayer = useMapV2Store((s) => s.toggleLayer);
  const contactFilters = useMapV2Store((s) => s.layerFilters.contacts);
  const vacancyFilters = useMapV2Store((s) => s.layerFilters.vacancies);
  const activityFilters = useMapV2Store((s) => s.layerFilters.activities);
  const planFilters = useMapV2Store((s) => s.layerFilters.plans);
  const vacancyDateRange = useMapV2Store((s) => s.dateRange.vacancies);
  const activityDateRange = useMapV2Store((s) => s.dateRange.activities);


  // Location search state
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [districtSuggestions, setDistrictSuggestions] = useState<DistrictSuggestion[]>([]);
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
      setDistrictSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const [locationResults, districtResults] = await Promise.all([
        searchLocations(value),
        fetch(`/api/districts?search=${encodeURIComponent(value)}&limit=5`)
          .then((r) => r.ok ? r.json() : { districts: [] })
          .then((data: { districts: DistrictSuggestion[] }) => (data.districts || []).slice(0, 5))
          .catch(() => [] as DistrictSuggestion[]),
      ]);
      setSuggestions(locationResults);
      setDistrictSuggestions(districtResults);
      setShowSuggestions(districtResults.length > 0 || locationResults.length > 0);
    }, 350);
  }, []);

  const handleSelectDistrict = useCallback(async (district: DistrictSuggestion) => {
    setQuery("");
    setShowSuggestions(false);
    setSuggestions([]);
    setDistrictSuggestions([]);

    // Select district and show in results panel
    const store = useMapV2Store.getState();
    store.clearDistrictSelection();
    store.toggleDistrictSelection(district.leaid);
    store.openResultsPanel("districts");

    // Fly to district location using city + state
    const city = district.cityLocation || district.name.replace(/\s*(School District|Community School District|Unified School District|Independent School District|Public Schools|Public School District|City School District|County School District|County Schools|Schools|SD)$/i, "");
    const locationQuery = `${city}, ${district.stateAbbrev || ""}`;
    const results = await searchLocations(locationQuery);
    const map = mapV2Ref.current;
    if (map && results.length > 0) {
      const panelPadding = map.getContainer().clientWidth * 0.4;
      map.flyTo({ center: [results[0].lng, results[0].lat], zoom: 9, duration: 1200, padding: { top: 50, bottom: 50, left: 50, right: panelPadding + 50 } });
    }
  }, []);

  const handleSelectLocation = useCallback((suggestion: GeocodeSuggestion) => {
    setQuery(suggestion.displayName.split(",")[0]);
    setShowSuggestions(false);
    setSuggestions([]);
    setDistrictSuggestions([]);
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

  /** Handle chevron click on an entity layer button: if layer is off, turn it on and open dropdown.
   *  Also opens the results panel on the corresponding tab when the dropdown is being opened. */
  const handleEntityChevronClick = useCallback((layerName: string, layerType: OverlayLayerType) => {
    const store = useMapV2Store.getState();
    if (!store.activeLayers.has(layerType)) {
      toggleLayer(layerType);
    }
    setOpenDropdown((prev) => {
      const isOpening = prev !== layerName;
      if (isOpening) {
        useMapV2Store.getState().openResultsPanel(layerType as LayerType);
      }
      return isOpening ? layerName : null;
    });
  }, [toggleLayer]);

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

          {/* Search suggestions dropdown */}
          {showSuggestions && (districtSuggestions.length > 0 || suggestions.length > 0) && (
            <div className="absolute top-full left-0 mt-1 w-80 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden z-50">
              {districtSuggestions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider bg-[#F7F5FA]">
                    Districts
                  </div>
                  {districtSuggestions.map((d) => (
                    <button
                      key={d.leaid}
                      onClick={() => handleSelectDistrict(d)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFEDF5] transition-colors border-b border-[#E2DEEC] last:border-0 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5 text-plum/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span>
                        <span className="text-[#544A78]">{d.name}</span>
                        {d.stateAbbrev && (
                          <span className="text-[#A69DC0] text-xs ml-1">{d.stateAbbrev}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </>
              )}
              {suggestions.length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider bg-[#F7F5FA]">
                    Locations
                  </div>
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectLocation(s)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-[#EFEDF5] transition-colors border-b border-[#E2DEEC] last:border-0 flex items-center gap-2"
                    >
                      <svg className="w-3.5 h-3.5 text-plum/50 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>
                        <span className="text-[#544A78]">{s.displayName.split(",")[0]}</span>
                        <span className="text-[#A69DC0] text-xs ml-1">
                          {s.displayName.split(",").slice(1).join(",").trim()}
                        </span>
                      </span>
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-[#D4CFE2]" />

        {/* Geography — always active, opens GeographyDropdown */}
        <DomainButton label="Geography" isOpen={openDropdown === "geography"} onClick={() => toggleDropdown("geography")} count={countByDomain(searchFilters, "geography")} />

        {/* Divider */}
        <div className="w-px h-6 bg-[#D4CFE2]" />

        {/* Entity layer toggle + filter buttons — always visible */}
        <div className="flex items-center gap-1">
          {/* Districts — always active, not toggleable */}
          <EntityLayerButton
            label="Districts"
            color="#403770"
            active={true}
            isOpen={openDropdown === "districts"}
            onToggle={() => {/* Districts are always visible */}}
            onChevronClick={() => handleEntityChevronClick("districts", "districts")}
            count={countByDomain(searchFilters, "fullmind") + countByDomain(searchFilters, "competitors") + countByDomain(searchFilters, "finance") + countByDomain(searchFilters, "demographics") + countByDomain(searchFilters, "academics")}
          />
          <EntityLayerButton
            label="Contacts"
            color="#F37167"
            active={activeLayers.has("contacts")}
            isOpen={openDropdown === "contacts"}
            onToggle={() => toggleLayer("contacts")}
            onChevronClick={() => handleEntityChevronClick("contacts", "contacts")}
            count={activeLayers.has("contacts") ? countContactFilters(contactFilters) : 0}
          />
          <EntityLayerButton
            label="Vacancies"
            color="#FFCF70"
            active={activeLayers.has("vacancies")}
            isOpen={openDropdown === "vacancies"}
            onToggle={() => toggleLayer("vacancies")}
            onChevronClick={() => handleEntityChevronClick("vacancies", "vacancies")}
            count={activeLayers.has("vacancies") ? countVacancyFilters(vacancyFilters, vacancyDateRange) : 0}
          />
          <EntityLayerButton
            label="Activities"
            color="#6EA3BE"
            active={activeLayers.has("activities")}
            isOpen={openDropdown === "activities"}
            onToggle={() => toggleLayer("activities")}
            onChevronClick={() => handleEntityChevronClick("activities", "activities")}
            count={activeLayers.has("activities") ? countActivityFilters(activityFilters, activityDateRange) : 0}
          />
          <EntityLayerButton
            label="Plans"
            color="#7B6BA4"
            active={activeLayers.has("plans")}
            isOpen={openDropdown === "plans"}
            onToggle={() => toggleLayer("plans")}
            onChevronClick={() => handleEntityChevronClick("plans", "plans")}
            count={activeLayers.has("plans") ? countPlanFilters(planFilters) : 0}
          />
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

        {/* Fiscal Year selector + Compare */}
        {compareMode ? (
          <div className="flex items-center gap-1.5">
            <select
              value={compareFyA}
              onChange={(e) => setCompareFyA(e.target.value as FiscalYear)}
              className="px-1.5 py-1 text-[10px] font-semibold rounded border border-[#D4CFE2] bg-white text-[#544A78] focus:outline-none focus:ring-1 focus:ring-plum/30"
            >
              {(["fy24", "fy25", "fy26", "fy27"] as const).map((fy) => (
                <option key={fy} value={fy}>{fy.toUpperCase()}</option>
              ))}
            </select>
            <span className="text-[10px] text-[#A69DC0] font-medium">vs</span>
            <select
              value={compareFyB}
              onChange={(e) => setCompareFyB(e.target.value as FiscalYear)}
              className="px-1.5 py-1 text-[10px] font-semibold rounded border border-[#D4CFE2] bg-white text-[#544A78] focus:outline-none focus:ring-1 focus:ring-plum/30"
            >
              {(["fy24", "fy25", "fy26", "fy27"] as const).map((fy) => (
                <option key={fy} value={fy}>{fy.toUpperCase()}</option>
              ))}
            </select>
            <button
              onClick={exitCompareMode}
              className="px-2 py-1 text-[10px] font-semibold text-coral hover:text-coral/80 transition-colors"
            >
              Exit
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-white rounded-lg border border-[#D4CFE2] overflow-hidden">
              {(["fy25", "fy26", "fy27"] as const).map((fy) => (
                <button
                  key={fy}
                  onClick={() => setSelectedFiscalYear(fy)}
                  className={`px-2 py-1 text-[10px] font-semibold transition-colors ${
                    selectedFiscalYear === fy
                      ? "bg-plum text-white"
                      : "text-[#8A80A8] hover:text-[#544A78] hover:bg-[#EFEDF5]"
                  }`}
                >
                  {fy.toUpperCase()}
                </button>
              ))}
            </div>
            <button
              onClick={enterCompareMode}
              className="px-2 py-1 text-[10px] font-semibold text-[#8A80A8] hover:text-plum bg-white rounded-lg border border-[#D4CFE2] hover:border-plum/30 transition-colors"
            >
              Compare
            </button>
            {/* FY info tooltip */}
            <div className="relative group">
              <button
                className="flex items-center justify-center w-5 h-5 rounded-full text-[#A69DC0] hover:text-[#544A78] hover:bg-[#EFEDF5] transition-colors"
                aria-label="Fiscal year info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <div className="absolute right-0 top-full mt-1 w-56 p-2.5 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 text-xs text-[#6E6390] opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
                <p className="font-semibold text-[#544A78] mb-1">Fiscal Year</p>
                <p>Auto-detected from today&apos;s date. The fiscal year runs Jul 1 &ndash; Jun 30.</p>
                <p className="mt-1 text-[#8A80A8]">Before July: current calendar year (e.g., FY26 in April 2026). After June: next year.</p>
                <p className="mt-1 text-[#8A80A8]">Controls which financial data appears in filters, sort, and district cards.</p>
              </div>
            </div>
          </div>
        )}

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
          {openDropdown === "districts" && <DistrictsDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "contacts" && <ContactsDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "vacancies" && <VacanciesDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "activities" && <ActivitiesDropdown onClose={() => setOpenDropdown(null)} />}
          {openDropdown === "plans" && <PlansDropdown onClose={() => setOpenDropdown(null)} />}
        </div>
      )}
    </div>
  );
}

const DomainButton = React.memo(function DomainButton({
  label,
  isOpen,
  onClick,
  count,
}: {
  label: string;
  isOpen: boolean;
  onClick: () => void;
  count: number;
}) {
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
});

/** Entity layer toggle + filter button with split click targets:
 *  - Clicking the dot/label toggles the layer on/off
 *  - Clicking the chevron opens the filter dropdown (and activates layer if inactive)
 */
const EntityLayerButton = React.memo(function EntityLayerButton({
  label,
  color,
  active,
  isOpen,
  onToggle,
  onChevronClick,
  count,
}: {
  label: string;
  color: string;
  active: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onChevronClick: () => void;
  count: number;
}) {
  return (
    <div
      className={`flex items-center rounded-lg text-xs font-semibold transition-colors ${
        isOpen
          ? "bg-white shadow-sm"
          : active
            ? "hover:bg-white hover:shadow-sm"
            : "hover:bg-white/60"
      }`}
      style={{
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: isOpen ? `${color}60` : active && count > 0 ? `${color}40` : "transparent",
      }}
    >
      {/* Dot + label — toggles layer on/off */}
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 pl-2.5 pr-1 py-1.5 rounded-l-lg transition-colors hover:bg-[#EFEDF5]/60"
        style={{ color: active ? undefined : "#8A80A8" }}
      >
        <span
          className="w-2 h-2 rounded-full shrink-0 transition-opacity duration-150"
          style={{
            backgroundColor: color,
            opacity: active ? 1 : 0.4,
          }}
        />
        <span style={{ color: active ? "#544A78" : "#8A80A8" }}>
          {label}
        </span>
        {active && count > 0 && (
          <span
            className="rounded-full text-[9px] font-bold flex items-center justify-center leading-none min-w-[16px] h-4 px-1 text-white"
            style={{ backgroundColor: color }}
          >
            {count}
          </span>
        )}
      </button>

      {/* Chevron — opens filter dropdown */}
      <button
        onClick={onChevronClick}
        className="flex items-center justify-center px-1.5 py-1.5 rounded-r-lg transition-colors hover:bg-[#EFEDF5]/80"
        style={{ color: active ? "#544A78" : "#8A80A8" }}
      >
        <svg
          className={`w-2.5 h-2.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
});
