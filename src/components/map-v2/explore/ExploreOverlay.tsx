"use client";

import { useEffect } from "react";
import { useMapV2Store, type ExploreEntity } from "@/lib/map-v2-store";
import { useExploreData } from "@/lib/api";
import ExploreKPICards from "./ExploreKPICards";
import ExploreTable from "./ExploreTable";
import ExploreColumnPicker from "./ExploreColumnPicker";
import ExploreFilters from "./ExploreFilters";
import BulkActionBar from "./BulkActionBar";
import RightPanel from "../RightPanel";

const ENTITY_TABS: { key: ExploreEntity; label: string; path: string; stroke: boolean }[] = [
  { key: "districts", label: "Districts", path: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z", stroke: false },
  { key: "activities", label: "Activities", path: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3", stroke: true },
  { key: "tasks", label: "Tasks", path: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13", stroke: true },
  { key: "contacts", label: "Contacts", path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13", stroke: true },
];

export default function ExploreOverlay() {
  const isExploreActive = useMapV2Store((s) => s.isExploreActive);
  const exploreEntity = useMapV2Store((s) => s.exploreEntity);
  const setExploreEntity = useMapV2Store((s) => s.setExploreEntity);
  const setActiveIconTab = useMapV2Store((s) => s.setActiveIconTab);
  const exploreFilters = useMapV2Store((s) => s.exploreFilters);
  const exploreSort = useMapV2Store((s) => s.exploreSort);
  const explorePage = useMapV2Store((s) => s.explorePage);
  const exploreColumns = useMapV2Store((s) => s.exploreColumns);
  const setExploreColumns = useMapV2Store((s) => s.setExploreColumns);
  const addExploreFilter = useMapV2Store((s) => s.addExploreFilter);
  const updateExploreFilter = useMapV2Store((s) => s.updateExploreFilter);
  const removeExploreFilter = useMapV2Store((s) => s.removeExploreFilter);
  const clearExploreFilters = useMapV2Store((s) => s.clearExploreFilters);
  const setExploreSort = useMapV2Store((s) => s.setExploreSort);
  const setExplorePage = useMapV2Store((s) => s.setExplorePage);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);

  // Bulk selection
  const selectedDistrictLeaids = useMapV2Store((s) => s.selectedDistrictLeaids);
  const selectAllMatchingFilters = useMapV2Store((s) => s.selectAllMatchingFilters);
  const toggleDistrictSelection = useMapV2Store((s) => s.toggleDistrictSelection);
  const setDistrictSelection = useMapV2Store((s) => s.setDistrictSelection);
  const clearDistrictSelection = useMapV2Store((s) => s.clearDistrictSelection);
  const setSelectAllMatchingFilters = useMapV2Store((s) => s.setSelectAllMatchingFilters);

  // Load column selections from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("explore-columns");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        Object.entries(parsed).forEach(([entity, cols]) => {
          setExploreColumns(entity as ExploreEntity, cols as string[]);
        });
      } catch {
        // ignore corrupt data
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Save column selections to localStorage on change
  useEffect(() => {
    localStorage.setItem("explore-columns", JSON.stringify(exploreColumns));
  }, [exploreColumns]);

  // Close right panel when switching entity tabs
  useEffect(() => {
    closeRightPanel();
  }, [exploreEntity]); // eslint-disable-line react-hooks/exhaustive-deps

  // Escape key exits Explore mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isExploreActive) {
        setActiveIconTab("home");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isExploreActive, setActiveIconTab]);

  // Row click → open district card in right panel
  const handleRowClick = (row: Record<string, unknown>) => {
    if (exploreEntity === "districts" && row.leaid) {
      openRightPanel({ type: "district_card", id: row.leaid as string });
    }
  };

  // Sort toggle handler
  const handleSort = (column: string) => {
    const currentSorts = exploreSort[exploreEntity];
    const existing = currentSorts.find((s) => s.column === column);
    if (existing) {
      setExploreSort(exploreEntity, [{
        column,
        direction: existing.direction === "asc" ? "desc" : "asc",
      }]);
    } else {
      setExploreSort(exploreEntity, [{ column, direction: "asc" }]);
    }
  };

  // Fetch data
  const { data: result, isLoading } = useExploreData(exploreEntity, {
    filters: exploreFilters[exploreEntity],
    sorts: exploreSort[exploreEntity],
    page: explorePage,
  });

  if (!isExploreActive) return null;

  return (
    <div className="absolute inset-0 z-20 flex bg-[#FFFCFA]">
      {/* Left sidebar: back + entity tabs */}
      <div className="w-14 bg-white border-r border-gray-200/60 flex flex-col items-center pt-3 gap-1 shrink-0">
        {/* Back to map button */}
        <button
          onClick={() => setActiveIconTab("home")}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#403770] hover:bg-[#C4E7E6]/20 transition-all group relative"
          title="Back to Map"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 12L6 8L10 4" />
          </svg>
          <span className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
            Back to Map
          </span>
        </button>

        <div className="w-6 border-t border-[#403770]/10 my-1" />

        {ENTITY_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setExploreEntity(tab.key)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all group relative ${
              exploreEntity === tab.key
                ? "bg-[#C4E7E6]/40 shadow-sm"
                : "text-gray-400 hover:text-[#403770] hover:bg-[#C4E7E6]/15"
            }`}
            title={tab.label}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill={!tab.stroke && exploreEntity === tab.key ? "#403770" : "none"}
              stroke={tab.stroke || exploreEntity !== tab.key ? (exploreEntity === tab.key ? "#403770" : "#9CA3AF") : "none"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={tab.path} />
            </svg>
            <span className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold text-[#403770]">
            Explore {exploreEntity.charAt(0).toUpperCase() + exploreEntity.slice(1)}
          </h1>
          <span className="text-[13px] text-gray-400 font-medium tabular-nums">
            {result?.pagination?.total?.toLocaleString() || "\u2014"} total
          </span>
        </div>

        {/* Filter bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-2 shrink-0 flex items-center justify-between gap-4">
          <ExploreFilters
            entity={exploreEntity}
            filters={exploreFilters[exploreEntity]}
            onAddFilter={(f) => addExploreFilter(exploreEntity, f)}
            onUpdateFilter={(id, updates) => updateExploreFilter(exploreEntity, id, updates)}
            onRemoveFilter={(id) => removeExploreFilter(exploreEntity, id)}
            onClearAll={() => clearExploreFilters(exploreEntity)}
          />
          <ExploreColumnPicker
            entity={exploreEntity}
            selectedColumns={exploreColumns[exploreEntity]}
            onColumnsChange={(cols) => setExploreColumns(exploreEntity, cols)}
          />
        </div>

        {/* KPI summary cards */}
        <div className="px-6 py-3 shrink-0">
          <ExploreKPICards
            entity={exploreEntity}
            aggregates={result?.aggregates}
            isLoading={isLoading}
          />
        </div>

        {/* Data table */}
        <div className="flex-1 px-6 pb-6 overflow-hidden">
          <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm h-full flex flex-col overflow-hidden">
            <ExploreTable
              data={result?.data || []}
              visibleColumns={exploreColumns[exploreEntity]}
              sorts={exploreSort[exploreEntity]}
              onSort={handleSort}
              onRowClick={handleRowClick}
              isLoading={isLoading}
              pagination={result?.pagination}
              onPageChange={(page) => setExplorePage(page)}
              entityType={exploreEntity}
              selectedIds={exploreEntity === "districts" ? selectedDistrictLeaids : undefined}
              onToggleSelect={exploreEntity === "districts" ? toggleDistrictSelection : undefined}
              onSelectPage={exploreEntity === "districts" ? (ids) => setDistrictSelection(ids) : undefined}
              onClearSelection={exploreEntity === "districts" ? clearDistrictSelection : undefined}
            />

            {/* Bulk action bar */}
            {exploreEntity === "districts" && (
              <BulkActionBar
                selectedCount={selectedDistrictLeaids.size}
                selectedIds={Array.from(selectedDistrictLeaids)}
                selectAllMatchingFilters={selectAllMatchingFilters}
                totalMatching={result?.pagination?.total ?? 0}
                filters={exploreFilters.districts}
                onSelectAllMatching={() => setSelectAllMatchingFilters(true)}
                onClearSelection={clearDistrictSelection}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right panel (district card) - shown when a row is clicked */}
      {rightPanelContent && <RightPanel />}
    </div>
  );
}
