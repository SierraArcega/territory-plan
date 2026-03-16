"use client";

import { useEffect, useRef, useCallback, useState } from "react";
// useCallback kept for handleSelectAll below
import { useMapV2Store } from "@/features/map/lib/store";
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
  const [hasMore, setHasMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Fetch results — reads from store snapshot to avoid stale closures
  const fetchResults = useCallback(async (pageNum: number, append: boolean = false) => {
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
      params.set("limit", "50");

      const res = await fetch(`/api/districts/search?${params}`, {
        signal: controller.signal,
      });

      if (!res.ok) throw new Error("Search failed");

      const json = await res.json();

      if (append) {
        setDistricts((prev) => [...prev, ...json.data]);
      } else {
        setDistricts(json.data);
      }
      setTotal(json.pagination.total);
      setHasMore(pageNum < json.pagination.totalPages);

      // Update matching leaids + centroids for map highlighting
      // Always set both — use empty arrays as fallback to clear stale data when 0 results
      state.setSearchResultLeaids(json.matchingLeaids ?? []);
      state.setSearchResultCentroids(json.matchingCentroids ?? []);
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Search fetch failed:", error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-fetch when filters, bounds, or sort change
  useEffect(() => {
    if (!isSearchActive) {
      setDistricts([]);
      setTotal(0);
      return;
    }
    setPage(1);
    fetchResults(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilters, searchBounds, searchSort, isSearchActive]);

  // Load more
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchResults(nextPage, true);
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
    <div className="absolute top-16 right-3 bottom-12 w-[300px] z-10 flex flex-col bg-white rounded-xl shadow-xl border border-[#D4CFE2]/60 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#E2DEEC] flex items-center justify-between shrink-0">
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

      {/* Results list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && districts.length === 0 ? (
          // Skeleton loading
          <div className="space-y-0">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-3 py-3 border-b border-[#E2DEEC] animate-pulse">
                <div className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded bg-[#F7F5FA] shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-[#F7F5FA] rounded w-3/4" />
                    <div className="h-2.5 bg-[#EFEDF5] rounded w-1/2" />
                    <div className="flex gap-2">
                      <div className="h-2.5 bg-[#EFEDF5] rounded w-16" />
                      <div className="h-2.5 bg-[#EFEDF5] rounded w-12" />
                    </div>
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
          <>
            {districts.map((d) => (
              <DistrictSearchCard
                key={d.leaid}
                district={d}
                isSelected={selectedDistrictLeaids.has(d.leaid)}
                onToggleSelect={() => toggleDistrictSelection(d.leaid)}
                activeFilters={searchFilters}
              />
            ))}

            {/* Load more */}
            {hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full py-3 text-xs font-medium text-plum hover:bg-plum/5 transition-colors disabled:opacity-50"
              >
                {loading ? "Loading..." : `Load more (${districts.length} of ${total})`}
              </button>
            )}
          </>
        )}

        {/* Loading indicator for appending */}
        {loading && districts.length > 0 && (
          <div className="py-3 flex justify-center">
            <div className="w-5 h-5 border-2 border-plum/20 border-t-plum rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      <SearchBulkBar selectedCount={selectedCount} />
    </div>
  );
}
