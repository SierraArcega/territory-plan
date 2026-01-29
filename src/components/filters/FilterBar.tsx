"use client";

import { useMapStore, StatusFilter } from "@/lib/store";
import { useStates, useSalesExecutives } from "@/lib/api";
import SearchBox from "./SearchBox";
import MultiSelectToggle from "./MultiSelectToggle";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All Districts" },
  { value: "customer", label: "Customers" },
  { value: "pipeline", label: "Pipeline" },
  { value: "customer_pipeline", label: "Customer + Pipeline" },
  { value: "no_data", label: "No Fullmind Data" },
];

export default function FilterBar() {
  const {
    filters,
    setStateFilter,
    setStatusFilter,
    setSalesExecutive,
    clearFilters,
  } = useMapStore();

  const { data: states } = useStates();
  const { data: salesExecs } = useSalesExecutives();

  const hasActiveFilters =
    filters.stateAbbrev ||
    filters.statusFilter !== "all" ||
    filters.salesExecutive ||
    filters.searchQuery;

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[200px] max-w-md">
          <SearchBox />
        </div>

        {/* State Filter */}
        <div>
          <select
            value={filters.stateAbbrev || ""}
            onChange={(e) => setStateFilter(e.target.value || null)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]"
          >
            <option value="">All States</option>
            {states?.map((state) => (
              <option key={state.abbrev} value={state.abbrev}>
                {state.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filters.statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Sales Executive Filter */}
        <div>
          <select
            value={filters.salesExecutive || ""}
            onChange={(e) => setSalesExecutive(e.target.value || null)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]"
          >
            <option value="">All Sales Execs</option>
            {salesExecs?.map((exec) => (
              <option key={exec} value={exec}>
                {exec}
              </option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="px-3 py-2 text-sm text-[#F37167] hover:text-[#403770] font-medium flex items-center gap-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            Clear
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Multi-Select Toggle */}
        <MultiSelectToggle />
      </div>

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
          <span className="text-gray-500">Active filters:</span>
          {filters.stateAbbrev && (
            <span className="px-2 py-0.5 bg-[#C4E7E6] text-[#403770] rounded">
              {filters.stateAbbrev}
            </span>
          )}
          {filters.statusFilter !== "all" && (
            <span className="px-2 py-0.5 bg-[#C4E7E6] text-[#403770] rounded">
              {STATUS_OPTIONS.find((o) => o.value === filters.statusFilter)
                ?.label}
            </span>
          )}
          {filters.salesExecutive && (
            <span className="px-2 py-0.5 bg-[#C4E7E6] text-[#403770] rounded">
              {filters.salesExecutive}
            </span>
          )}
          {filters.searchQuery && (
            <span className="px-2 py-0.5 bg-[#C4E7E6] text-[#403770] rounded">
              &quot;{filters.searchQuery}&quot;
            </span>
          )}
        </div>
      )}
    </div>
  );
}
