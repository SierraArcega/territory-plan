"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import { createPortal } from "react-dom";
// useCallback kept for handleSelectAll below
import { useMapV2Store } from "@/features/map/lib/store";
import { mapV2Ref } from "@/features/map/lib/ref";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import { useProfile } from "@/features/shared/lib/queries";
import {
  useMapContacts,
  useMapVacancies,
  useMapActivities,
  useMapPlans,
} from "@/features/map/lib/queries";
import type { LayerType } from "@/features/map/lib/layers";
import { useCrossFilter } from "@/features/map/lib/useCrossFilter";
import DistrictSearchCard from "./DistrictSearchCard";
import DistrictExploreModal from "./DistrictExploreModal";
import ResultsTabStrip from "./ResultsTabStrip";
import PlansTab from "./PlansTab";
import ContactsTab from "./ContactsTab";
import VacanciesTab from "./VacanciesTab";
import ActivitiesTab from "./ActivitiesTab";

interface SearchResultDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string;
  countyName: string | null;
  enrollment: number | null;
  isCustomer: boolean | null;
  accountType: string | null;
  owner: string | null;
  ellPct: number | null;
  swdPct: number | null;
  childrenPovertyPercent: number | null;
  medianHouseholdIncome: number | null;
  expenditurePerPupil: number | null;
  urbanCentricLocale: number | null;
  fy26OpenPipeline: number | null;
  fy26ClosedWonNetBooking: number | null;
  territoryPlans: Array<{ plan: { id: string; name: string; color: string } }>;
}

/** Build a compact page number list with ellipsis, e.g. [1, 2, 3, "...", 10] */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [];
  pages.push(1);
  if (current > 3) pages.push("...");
  for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}

function LayerOffPrompt({ layer }: { layer: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
      <svg className="w-12 h-12 text-[#D4CFE2] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      </svg>
      <p className="text-sm font-medium text-[#8A80A8]">{layer} layer is off</p>
      <p className="text-xs text-[#A69DC0] mt-1">Enable the {layer} layer in the toolbar to see data here</p>
    </div>
  );
}

export default function SearchResults() {
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const searchBounds = useMapV2Store((s) => s.searchBounds);
  const searchSort = useMapV2Store((s) => s.searchSort);
  const isSearchActive = useMapV2Store((s) => s.isSearchActive);
  const searchResultsVisible = useMapV2Store((s) => s.searchResultsVisible);
  const toggleSearchResults = useMapV2Store((s) => s.toggleSearchResults);
  const selectedDistrictLeaids = useMapV2Store((s) => s.selectedDistrictLeaids);
  const toggleDistrictSelection = useMapV2Store((s) => s.toggleDistrictSelection);
  const setDistrictSelection = useMapV2Store((s) => s.setDistrictSelection);
  const setSearchResultLeaids = useMapV2Store((s) => s.setSearchResultLeaids);

  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const activeResultsTab = useMapV2Store((s) => s.activeResultsTab);
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const dateRange = useMapV2Store((s) => s.dateRange);
  const mapBounds = useMapV2Store((s) => s.mapBounds);

  const { data: plans } = useTerritoryPlans();
  const { data: profile } = useProfile();
  const addDistricts = useAddDistrictsToPlan();
  const searchResultLeaids = useMapV2Store((s) => s.searchResultLeaids);
  const exploreModalLeaid = useMapV2Store((s) => s.exploreModalLeaid);
  const setExploreModalLeaid = useMapV2Store((s) => s.setExploreModalLeaid);
  const [showMyPlansOnly, setShowMyPlansOnly] = useState(true);

  // Extract geographic state filters from searchFilters to apply to overlay layers
  const geoStates = useMemo(() => {
    const stateFilter = searchFilters.find((f) => f.column === "state");
    if (!stateFilter) return undefined;
    if (stateFilter.op === "in" && Array.isArray(stateFilter.value)) {
      return stateFilter.value as string[];
    }
    if (stateFilter.op === "eq" && typeof stateFilter.value === "string") {
      return [stateFilter.value];
    }
    return undefined;
  }, [searchFilters]);

  // Overlay query hooks — enabled when layer is active
  const contactsQuery = useMapContacts(
    mapBounds,
    layerFilters.contacts,
    activeLayers.has("contacts"),
    geoStates,
  );
  const vacanciesQuery = useMapVacancies(
    mapBounds,
    layerFilters.vacancies,
    dateRange.vacancies,
    activeLayers.has("vacancies"),
    geoStates,
  );
  const activitiesQuery = useMapActivities(
    mapBounds,
    layerFilters.activities,
    dateRange.activities,
    activeLayers.has("activities"),
    geoStates,
  );
  const plansQuery = useMapPlans(
    layerFilters.plans,
    activeLayers.has("plans"),
  );

  // Cross-filter — single source of truth
  const {
    overlayDerivedLeaids,
    filteredContacts,
    filteredVacancies,
    filteredActivities,
  } = useCrossFilter({
    plansGeoJSON: plansQuery.data,
    contactsGeoJSON: contactsQuery.data,
    vacanciesGeoJSON: vacanciesQuery.data,
    activitiesGeoJSON: activitiesQuery.data,
  });

  const [districts, setDistricts] = useState<SearchResultDistrict[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [showAddAllDropdown, setShowAddAllDropdown] = useState(false);
  const [planSearchQuery, setPlanSearchQuery] = useState("");
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [showSaveSearch, setShowSaveSearch] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState("");
  const addAllRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldFitBoundsRef = useRef(false);

  // Fetch results — reads from store snapshot to avoid stale closures
  const fetchResults = useCallback(async (pageNum: number, leaidOverride?: string[]) => {
    // Read current state directly from store (not from closure)
    const state = useMapV2Store.getState();
    if (!state.isSearchActive && !leaidOverride?.length) return;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (!leaidOverride && state.searchBounds) {
        params.set("bounds", state.searchBounds.join(","));
      }
      if (state.searchFilters.length > 0) {
        params.set("filters", JSON.stringify(state.searchFilters));
      }
      if (leaidOverride?.length) {
        params.set("leaids", leaidOverride.join(","));
      }
      params.set("sort", state.searchSort.column);
      params.set("order", state.searchSort.direction);
      params.set("page", String(pageNum));
      params.set("limit", "25");

      const res = await fetch(`/api/districts/search?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Search failed");

      const json = await res.json();

      setDistricts(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);

      // Only update search result leaids for actual searches — not overlay-derived fetches.
      // Writing these during overlay mode creates a feedback loop via overlayLeaidSet.
      if (!leaidOverride) {
        state.setSearchResultLeaids(json.matchingLeaids ?? []);
        state.setSearchResultCentroids(json.matchingCentroids ?? []);
      }

      // Fit map to matching centroids only when filters change (not on pan/zoom)
      if (shouldFitBoundsRef.current) {
        shouldFitBoundsRef.current = false;
        const centroids = json.matchingCentroids as Array<{ lat: number; lng: number }> | undefined;
        const map = mapV2Ref.current;
        if (map && centroids && centroids.length > 0) {
          const lngs = centroids.map((c) => c.lng);
          const lats = centroids.map((c) => c.lat);
          const sw: [number, number] = [Math.min(...lngs), Math.min(...lats)];
          const ne: [number, number] = [Math.max(...lngs), Math.max(...lats)];
          const container = map.getContainer();
          const panelWidth = container.offsetWidth * 0.4;
          map.fitBounds([sw, ne], {
            padding: { top: 40, bottom: 40, left: 40, right: panelWidth + 40 },
            maxZoom: 12,
            duration: 1000,
          });
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Search fetch failed:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when filters change — also fit map to results
  useEffect(() => {
    if (!isSearchActive) {
      // If overlay layers produce leaids, those are handled separately
      if (overlayDerivedLeaids) return;
      setDistricts([]);
      setTotal(0);
      return;
    }
    shouldFitBoundsRef.current = true;
    setPage(1);
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters, searchSort, isSearchActive]);

  // Fetch districts from overlay-derived leaids (when no explicit search is active)
  useEffect(() => {
    if (isSearchActive) return;
    if (!overlayDerivedLeaids) {
      // Overlay filters were removed — clear district results
      setDistricts([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setPage(1);
    fetchResults(1, [...overlayDerivedLeaids]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayDerivedLeaids, isSearchActive]);

  // Fetch districts selected via map clicks (when no search/overlay is driving results)
  useEffect(() => {
    if (isSearchActive || overlayDerivedLeaids) return;
    if (selectedDistrictLeaids.size === 0) {
      setDistricts([]);
      setTotal(0);
      setTotalPages(0);
      return;
    }
    setPage(1);
    fetchResults(1, [...selectedDistrictLeaids]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDistrictLeaids, isSearchActive, overlayDerivedLeaids]);

  // Re-fetch when bounds change (pan/zoom) — no fitBounds to avoid loop
  useEffect(() => {
    if (!isSearchActive || !searchBounds) return;
    setPage(1);
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchBounds]);

  // Pagination
  const goToPage = (p: number) => {
    setPage(p);
    fetchResults(p);
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Sort options
  const sortOptions = [
    { column: "enrollment", label: "Enrollment" },
    { column: "name", label: "Name" },
    { column: "expenditurePerPupil", label: "Expenditure/Pupil" },
    { column: "fy26_open_pipeline_value", label: "Pipeline Value" },
  ];

  // Close add-all dropdown on outside click
  useEffect(() => {
    if (!showAddAllDropdown) return;
    const handler = (e: MouseEvent) => {
      if (addAllRef.current && !addAllRef.current.contains(e.target as Node)) {
        setShowAddAllDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showAddAllDropdown]);

  const togglePlanSelection = (planId: string) => {
    setSelectedPlanIds((prev) => {
      const next = new Set(prev);
      if (next.has(planId)) next.delete(planId);
      else next.add(planId);
      return next;
    });
  };

  const handleAddToSelectedPlans = async () => {
    if (selectedPlanIds.size === 0) return;
    const leaidsToAdd = selectedDistrictLeaids.size > 0
      ? [...selectedDistrictLeaids]
      : searchResultLeaids;
    if (leaidsToAdd.length === 0) return;
    try {
      await Promise.all(
        [...selectedPlanIds].map((planId) =>
          addDistricts.mutateAsync({ planId, leaids: leaidsToAdd })
        )
      );
      setShowAddAllDropdown(false);
      setSelectedPlanIds(new Set());
      setPlanSearchQuery("");
    } catch (error) {
      console.error("Failed to add districts to plans:", error);
    }
  };

  // Export all matching districts as CSV
  const handleExportCsv = useCallback(async () => {
    const state = useMapV2Store.getState();
    if (!state.isSearchActive) return;
    setExporting(true);

    try {
      // Fetch all results (no pagination limit)
      const params = new URLSearchParams();
      if (state.searchBounds) params.set("bounds", state.searchBounds.join(","));
      if (state.searchFilters.length > 0) params.set("filters", JSON.stringify(state.searchFilters));
      params.set("sort", state.searchSort.column);
      params.set("order", state.searchSort.direction);
      params.set("page", "1");
      params.set("limit", "10000");

      const res = await fetch(`/api/districts/search?${params}`);
      if (!res.ok) throw new Error("Export failed");
      const json = await res.json();
      const rows = json.data as SearchResultDistrict[];

      // Build CSV
      const headers = ["LEAID", "Name", "State", "County", "Enrollment", "Customer", "Owner", "ELL %", "SWD %", "Poverty %", "Median Income", "$/Pupil", "FY26 Pipeline", "FY26 Bookings", "Plans"];
      const csvRows = rows.map((d) => [
        d.leaid,
        `"${(d.name || "").replace(/"/g, '""')}"`,
        d.stateAbbrev,
        d.countyName || "",
        d.enrollment ?? "",
        d.isCustomer ? "Yes" : "No",
        d.owner || "",
        d.ellPct != null ? `${Number(d.ellPct).toFixed(1)}%` : "",
        d.swdPct != null ? `${Number(d.swdPct).toFixed(1)}%` : "",
        d.childrenPovertyPercent != null ? `${Number(d.childrenPovertyPercent).toFixed(1)}%` : "",
        d.medianHouseholdIncome ?? "",
        d.expenditurePerPupil ?? "",
        d.fy26OpenPipeline ?? "",
        d.fy26ClosedWonNetBooking ?? "",
        `"${(d.territoryPlans || []).map((tp) => tp.plan.name).join(", ")}"`,
      ].join(","));

      const csv = [headers.join(","), ...csvRows].join("\n");
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `district-search-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setExporting(false);
    }
  }, []);

  // Save current search filters as a named preset
  const handleSaveSearch = () => {
    if (!saveSearchName.trim()) return;
    const state = useMapV2Store.getState();
    const saved = JSON.parse(localStorage.getItem("savedSearches") || "[]");
    saved.push({
      id: crypto.randomUUID(),
      name: saveSearchName.trim(),
      filters: state.searchFilters,
      sort: state.searchSort,
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem("savedSearches", JSON.stringify(saved));
    setSaveSearchName("");
    setShowSaveSearch(false);
  };

  // Select all visible
  const handleSelectAll = useCallback(() => {
    const allLeaids = districts.map((d) => d.leaid);
    const allSelected = allLeaids.every((id) => selectedDistrictLeaids.has(id));
    if (allSelected) {
      setDistrictSelection([]);
    } else {
      setDistrictSelection(allLeaids);
    }
  }, [districts, selectedDistrictLeaids, setDistrictSelection]);

  // Explore modal navigation
  const currentExploreIndex = exploreModalLeaid
    ? districts.findIndex((d) => d.leaid === exploreModalLeaid)
    : -1;
  const canGoPrev = currentExploreIndex > 0;
  const canGoNext = currentExploreIndex >= 0 && currentExploreIndex < districts.length - 1;

  const handleExplorePrev = () => {
    if (canGoPrev) setExploreModalLeaid(districts[currentExploreIndex - 1].leaid);
  };
  const handleExploreNext = () => {
    if (canGoNext) setExploreModalLeaid(districts[currentExploreIndex + 1].leaid);
  };

  // Compute feature counts for tab badges
  const tabCounts = useMemo((): Partial<Record<LayerType, number>> => {
    const counts: Partial<Record<LayerType, number>> = {};
    counts.districts = total;
    if (activeLayers.has("plans") && plansQuery.data) {
      // Deduplicate by planId
      const planIds = new Set<string>();
      for (const f of plansQuery.data.features) {
        const pid = f.properties?.planId;
        if (pid) planIds.add(pid);
      }
      counts.plans = planIds.size;
    }
    if (activeLayers.has("contacts") && filteredContacts) {
      counts.contacts = filteredContacts.features.length;
    }
    if (activeLayers.has("vacancies") && filteredVacancies) {
      counts.vacancies = filteredVacancies.features.length;
    }
    if (activeLayers.has("activities") && filteredActivities) {
      counts.activities = filteredActivities.features.length;
    }
    return counts;
  }, [total, activeLayers, plansQuery.data, filteredContacts, filteredVacancies, filteredActivities]);

  const showingOverlayTab = activeResultsTab !== "districts";
  const hasDistrictResults = isSearchActive || overlayDerivedLeaids != null || selectedDistrictLeaids.size > 0;

  const selectedCount = selectedDistrictLeaids.size;

  return (
    <div
      className={`absolute top-0 right-0 bottom-0 z-10 flex flex-col border-l border-[#D4CFE2]/60 transition-[width] duration-200 ease-in-out ${
        searchResultsVisible ? "w-[40%] bg-white overflow-hidden" : "w-0 overflow-visible"
      }`}
      onMouseEnter={() => useMapV2Store.getState().hideTooltip()}
    >
      {/* Collapsed — floating tab on the right edge */}
      {!searchResultsVisible && (
        <button
          onClick={toggleSearchResults}
          className="absolute top-3 -left-10 flex items-center gap-1.5 pl-2.5 pr-2.5 py-2 rounded-l-xl bg-plum shadow-lg hover:bg-plum/90 transition-colors"
          aria-label="Open results panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#544A78" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" stroke="white" />
          </svg>
          {total > 0 && (
            <span className="text-[10px] font-bold text-plum bg-white rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {total > 999 ? `${(total / 1000).toFixed(0)}k` : total}
            </span>
          )}
        </button>
      )}

      {searchResultsVisible && (
        <>
      {/* Tab strip — always visible with all entity tabs */}
      <ResultsTabStrip counts={tabCounts} onCollapse={toggleSearchResults} />

      {/* Cross-filter source indicator */}
      {!showingOverlayTab && !isSearchActive && overlayDerivedLeaids && (
        <div className="shrink-0 px-4 py-1.5 border-b border-[#E2DEEC] bg-[#F7F5FA] flex items-center justify-between">
          <span className="text-xs text-[#8A80A8]">
            Showing districts from filtered overlays
          </span>
        </div>
      )}

      {/* Districts header — only shown when districts tab is active and results exist */}
      {!showingOverlayTab && hasDistrictResults && (
        <div className="px-4 py-2 border-b border-[#E2DEEC] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAll}
              className="text-[10px] text-[#A69DC0] hover:text-plum transition-colors"
            >
              {districts.length > 0 && districts.every((d) => selectedDistrictLeaids.has(d.leaid))
                ? "Deselect all"
                : "Select all"
              }
            </button>
            <span className="text-xs font-medium text-[#544A78]">
              {total.toLocaleString()} district{total !== 1 ? "s" : ""}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* Sort dropdown */}
            <select
              value={searchSort.column}
              onChange={(e) => useMapV2Store.getState().setSearchSort({ ...searchSort, column: e.target.value })}
              className="text-[10px] text-[#8A80A8] bg-transparent border-none focus:outline-none cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option key={o.column} value={o.column}>{o.label}</option>
              ))}
            </select>

            {/* Sort direction */}
            <button
              onClick={() => useMapV2Store.getState().setSearchSort({
                ...searchSort,
                direction: searchSort.direction === "asc" ? "desc" : "asc",
              })}
              className="text-[#A69DC0] hover:text-[#6E6390]"
            >
              <svg className={`w-3 h-3 transition-transform ${searchSort.direction === "asc" ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

          </div>
        </div>
      )}

      {/* Actions bar — districts tab only */}
      {!showingOverlayTab && hasDistrictResults && total > 0 && (
        <div ref={addAllRef} className="relative px-4 py-2 border-b border-[#E2DEEC] bg-[#F7F5FA] shrink-0 flex items-center gap-2">
          {/* Save Search — only during explicit searches */}
          {isSearchActive && (showSaveSearch ? (
            <div className="flex items-center gap-1.5 flex-1">
              <input
                type="text"
                value={saveSearchName}
                onChange={(e) => setSaveSearchName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveSearch()}
                placeholder="Search name..."
                autoFocus
                className="flex-1 px-2 py-1 text-xs rounded border border-[#C2BBD4] bg-white focus:outline-none focus:ring-1 focus:ring-plum/30"
              />
              <button
                onClick={handleSaveSearch}
                disabled={!saveSearchName.trim()}
                className="px-2 py-1 rounded text-xs font-semibold text-white bg-plum hover:bg-[#322a5a] transition-colors disabled:opacity-40"
              >
                Save
              </button>
              <button
                onClick={() => { setShowSaveSearch(false); setSaveSearchName(""); }}
                className="text-[#A69DC0] hover:text-[#6E6390]"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowSaveSearch(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] hover:border-plum/30 hover:text-plum transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              Save Search
            </button>
          ))}

          {/* Export CSV — only during explicit searches */}
          {isSearchActive && !showSaveSearch && (
            <button
              onClick={handleExportCsv}
              disabled={exporting}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] hover:border-plum/30 hover:text-plum transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {exporting ? "Exporting..." : "Export CSV"}
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Add to Plan */}
          <button
            onClick={() => { setShowAddAllDropdown(!showAddAllDropdown); if (showAddAllDropdown) { setPlanSearchQuery(""); setSelectedPlanIds(new Set()); } }}
            disabled={addDistricts.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-plum hover:bg-[#322a5a] transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {addDistricts.isPending ? "Adding..." : selectedCount > 0
              ? `Add ${selectedCount} Selected to Plan`
              : `Add All ${total.toLocaleString()} to Plan`}
          </button>

          {showAddAllDropdown && plans && (() => {
            const filteredPlans = plans
              .filter((p) => p.name.toLowerCase().includes(planSearchQuery.toLowerCase()))
              .filter((p) => !showMyPlansOnly || p.owner?.id === profile?.id);
            return (
            <div className="absolute right-12 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-[#D4CFE2] overflow-hidden z-50">
              {/* Search + filter */}
              <div className="px-3 py-2 border-b border-[#E2DEEC] space-y-1.5">
                <input
                  type="text"
                  value={planSearchQuery}
                  onChange={(e) => setPlanSearchQuery(e.target.value)}
                  placeholder="Search plans..."
                  autoFocus
                  className="w-full px-2 py-1 text-xs rounded border border-[#C2BBD4] bg-white focus:outline-none focus:ring-1 focus:ring-plum/30"
                />
                <div className="flex border-b border-[#E2DEEC] -mx-3 -mb-2">
                  <button
                    onClick={() => setShowMyPlansOnly(true)}
                    className={`flex-1 text-[10px] font-semibold py-1.5 text-center transition-colors ${
                      showMyPlansOnly ? "text-plum border-b-2 border-plum" : "text-[#8A80A8] hover:text-[#544A78]"
                    }`}
                  >
                    My Plans
                  </button>
                  <button
                    onClick={() => setShowMyPlansOnly(false)}
                    className={`flex-1 text-[10px] font-semibold py-1.5 text-center transition-colors ${
                      !showMyPlansOnly ? "text-plum border-b-2 border-plum" : "text-[#8A80A8] hover:text-[#544A78]"
                    }`}
                  >
                    All Plans
                  </button>
                </div>
              </div>
              {/* Plan list */}
              <div className="max-h-48 overflow-y-auto">
                {filteredPlans.map((plan) => {
                    const isChecked = selectedPlanIds.has(plan.id);
                    return (
                      <button
                        key={plan.id}
                        onClick={() => togglePlanSelection(plan.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                          isChecked ? "bg-plum/5 text-plum" : "hover:bg-[#EFEDF5] text-[#544A78]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          readOnly
                          className="w-3.5 h-3.5 rounded border-[#C2BBD4] text-plum focus:ring-plum/30 pointer-events-none"
                        />
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                        <span className="truncate">{plan.name}</span>
                      </button>
                    );
                  })}
              </div>
              {/* Confirm button */}
              {selectedPlanIds.size > 0 && (
                <div className="px-3 py-2 border-t border-[#E2DEEC]">
                  <button
                    onClick={handleAddToSelectedPlans}
                    disabled={addDistricts.isPending}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold text-white bg-plum hover:bg-[#322a5a] transition-colors disabled:opacity-50"
                  >
                    {addDistricts.isPending
                      ? "Adding..."
                      : `Add to ${selectedPlanIds.size} plan${selectedPlanIds.size > 1 ? "s" : ""}`}
                  </button>
                </div>
              )}
            </div>
            );
          })()}
        </div>
      )}

      {/* Selection status — districts tab only */}
      {!showingOverlayTab && hasDistrictResults && selectedCount > 0 && (
        <div className="shrink-0 px-4 py-1.5 border-b border-[#E2DEEC] bg-[#e8f1f5] flex items-center justify-between">
          <span className="text-xs font-medium text-[#6EA3BE]">
            {selectedCount} selected
          </span>
          <button
            onClick={() => setDistrictSelection([])}
            className="text-xs text-[#8A80A8] hover:text-[#6EA3BE] font-medium transition-colors"
          >
            Clear
          </button>
        </div>
      )}

      {/* Overlay tab content */}
      {showingOverlayTab && activeResultsTab === "plans" && (
        activeLayers.has("plans")
          ? <PlansTab data={plansQuery.data} isLoading={plansQuery.isLoading} />
          : <LayerOffPrompt layer="Plans" />
      )}
      {showingOverlayTab && activeResultsTab === "contacts" && (
        activeLayers.has("contacts")
          ? <ContactsTab data={filteredContacts} isLoading={contactsQuery.isLoading} />
          : <LayerOffPrompt layer="Contacts" />
      )}
      {showingOverlayTab && activeResultsTab === "vacancies" && (
        activeLayers.has("vacancies")
          ? <VacanciesTab data={filteredVacancies} isLoading={vacanciesQuery.isLoading} />
          : <LayerOffPrompt layer="Vacancies" />
      )}
      {showingOverlayTab && activeResultsTab === "activities" && (
        activeLayers.has("activities")
          ? <ActivitiesTab data={filteredActivities} isLoading={activitiesQuery.isLoading} />
          : <LayerOffPrompt layer="Activities" />
      )}

      {/* Districts — empty state when no search */}
      {!showingOverlayTab && !hasDistrictResults && (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <svg className="w-12 h-12 text-[#D4CFE2] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm font-medium text-[#8A80A8]">No active search</p>
          <p className="text-xs text-[#A69DC0] mt-1">Use the filters above to search districts</p>
        </div>
      )}

      {/* Districts results grid — two columns with scroll */}
      {!showingOverlayTab && hasDistrictResults && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3">
          {loading && districts.length === 0 ? (
            // Skeleton loading — 2 column grid
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="p-3 rounded-lg border border-[#E2DEEC] animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3.5 bg-[#F7F5FA] rounded w-3/4" />
                    <div className="h-2.5 bg-[#EFEDF5] rounded w-1/2" />
                    <div className="flex gap-2">
                      <div className="h-2.5 bg-[#EFEDF5] rounded w-16" />
                      <div className="h-2.5 bg-[#EFEDF5] rounded w-12" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : districts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <svg className="w-10 h-10 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm text-[#8A80A8]">No districts match your filters in this area.</p>
              <p className="text-xs text-[#A69DC0] mt-1">Try zooming out or adjusting filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {districts.map((d) => (
                <DistrictSearchCard
                  key={d.leaid}
                  district={d}
                  isSelected={selectedDistrictLeaids.has(d.leaid)}
                  onToggleSelect={() => toggleDistrictSelection(d.leaid)}
                  onExplore={(leaid) => setExploreModalLeaid(leaid)}
                  activeFilters={searchFilters}
                />
              ))}
            </div>
          )}

          {/* Loading overlay for page transitions */}
          {loading && districts.length > 0 && (
            <div className="py-4 flex justify-center">
              <div className="w-5 h-5 border-2 border-plum/20 border-t-plum rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      {/* Footer — districts tab only, pagination controls when multi-page */}
      {!showingOverlayTab && hasDistrictResults && total > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-[#E2DEEC] flex items-center justify-between">
          {totalPages > 1 ? (
            <>
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1 || loading}
                className="px-2 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-1 text-xs text-[#A69DC0]">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => goToPage(p as number)}
                      disabled={loading}
                      className={`min-w-[28px] h-7 rounded text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-plum text-white"
                          : "text-[#6E6390] hover:bg-[#EFEDF5]"
                      }`}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>

              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages || loading}
                className="px-2 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                Next
              </button>
            </>
          ) : (
            <span className="w-full text-center text-xs text-[#A69DC0]">
              Showing {total} district{total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      {/* Explore modal — rendered via portal into document.body to escape stacking context */}
      {/* Explore modal — rendered via portal into document.body to escape stacking context */}
      {exploreModalLeaid && createPortal(
        <DistrictExploreModal
          leaid={exploreModalLeaid}
          onClose={() => setExploreModalLeaid(null)}
          onPrev={canGoPrev ? handleExplorePrev : undefined}
          onNext={canGoNext ? handleExploreNext : undefined}
          currentIndex={currentExploreIndex}
          totalCount={districts.length}
        />,
        document.body
      )}
      </>
      )}
    </div>
  );
}
