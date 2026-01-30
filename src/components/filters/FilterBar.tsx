"use client";

import Link from "next/link";
import { useMapStore, StatusFilter } from "@/lib/store";
import { useStates, useSalesExecutives, useTerritoryPlans } from "@/lib/api";
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
  const { data: plans } = useTerritoryPlans();

  // Count total districts across all plans
  const totalPlanDistricts = plans?.reduce(
    (sum, plan) => sum + (plan.districtCount || 0),
    0
  ) || 0;

  const hasActiveFilters =
    filters.stateAbbrev ||
    filters.statusFilter !== "all" ||
    filters.salesExecutive ||
    filters.searchQuery;

  // Common compact input styling
  const selectStyle =
    "h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770]";

  return (
    <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-2">
      <div className="flex items-center gap-3">
        {/* Fullmind Logo/Wordmark */}
        <Link
          href="/"
          className="flex-shrink-0 text-[#403770] font-bold text-base hover:text-[#F37167] transition-colors"
          title="Territory Plan Builder"
        >
          Fullmind
        </Link>

        {/* Divider */}
        <div className="h-6 border-l border-gray-200" />

        {/* Search */}
        <div className="flex-1 min-w-[180px] max-w-sm">
          <SearchBox compact />
        </div>

        {/* State Filter */}
        <select
          value={filters.stateAbbrev || ""}
          onChange={(e) => setStateFilter(e.target.value || null)}
          className={selectStyle}
        >
          <option value="">All States</option>
          {states?.map((state) => (
            <option key={state.abbrev} value={state.abbrev}>
              {state.name}
            </option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          value={filters.statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className={selectStyle}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Sales Executive Filter */}
        <select
          value={filters.salesExecutive || ""}
          onChange={(e) => setSalesExecutive(e.target.value || null)}
          className={selectStyle}
        >
          <option value="">All Sales Execs</option>
          {salesExecs?.map((exec) => (
            <option key={exec} value={exec}>
              {exec}
            </option>
          ))}
        </select>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="h-9 px-2 text-sm text-[#F37167] hover:text-[#403770] font-medium flex items-center gap-1"
            title="Clear all filters"
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
          </button>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Multi-Select Toggle */}
        <MultiSelectToggle />

        {/* Divider before Plans */}
        <div className="h-6 border-l border-gray-200" />

        {/* Plans Button */}
        <Link
          href="/plans"
          className="h-9 inline-flex items-center gap-2 px-3 text-sm font-medium text-white bg-[#403770] rounded-md hover:bg-[#302860] transition-colors"
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
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          Plans
          {totalPlanDistricts > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded">
              {totalPlanDistricts}
            </span>
          )}
        </Link>
      </div>

      {/* Active Filters Summary - compact row below if filters active */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 mt-1.5 text-xs">
          <span className="text-gray-400">Filters:</span>
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
