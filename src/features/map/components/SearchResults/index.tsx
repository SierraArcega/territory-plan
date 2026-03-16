"use client";

import { useEffect, useRef, useCallback, useState } from "react";
// useCallback kept for handleSelectAll below
import { useMapV2Store } from "@/features/map/lib/store";
import { mapV2Ref } from "@/features/map/lib/ref";
import DistrictSearchCard from "./DistrictSearchCard";
import SearchBulkBar from "./SearchBulkBar";

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

  const [districts, setDistricts] = useState<SearchResultDistrict[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldFitBoundsRef = useRef(false);

  // Fetch results — reads from store snapshot to avoid stale closures
  const fetchResults = useCallback(async (pageNum: number) => {
    // Read current state directly from store (not from closure)
    const state = useMapV2Store.getState();
    if (!state.isSearchActive) return;

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);

    try {
      const params = new URLSearchParams();
      if (state.searchBounds) {
        params.set("bounds", state.searchBounds.join(","));
      }
      if (state.searchFilters.length > 0) {
        params.set("filters", JSON.stringify(state.searchFilters));
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

      // Update matching leaids + centroids for map highlighting
      // Always set both — use empty arrays as fallback to clear stale data when 0 results
      state.setSearchResultLeaids(json.matchingLeaids ?? []);
      state.setSearchResultCentroids(json.matchingCentroids ?? []);

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
      setDistricts([]);
      setTotal(0);
      return;
    }
    shouldFitBoundsRef.current = true;
    setPage(1);
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters, searchSort, isSearchActive]);

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

  if (!isSearchActive || !searchResultsVisible) return null;

  const selectedCount = selectedDistrictLeaids.size;

  return (
    <div className="absolute top-0 right-0 bottom-0 w-[40%] z-10 flex flex-col bg-white border-l border-[#D4CFE2]/60 overflow-hidden">
      {/* Header */}
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

          {/* Close */}
          <button
            onClick={toggleSearchResults}
            className="ml-1 text-[#A69DC0] hover:text-[#6E6390]"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Results grid — two columns with scroll */}
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

      {/* Footer — always visible with result range; pagination controls when multi-page */}
      {total > 0 && (
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

      {/* Bulk action bar */}
      <SearchBulkBar selectedCount={selectedCount} />
    </div>
  );
}
