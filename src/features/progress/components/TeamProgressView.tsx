"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useTeamProgress } from "../lib/queries";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import type { PlanProgress } from "../lib/types";
import FilterBar, { type FilterConfig } from "@/features/plans/components/FilterBar";
import CategoryCard from "./CategoryCard";
import StackedProgressBar from "./StackedProgressBar";
import UnmappedAlert from "./UnmappedAlert";
import PlanProgressTable from "./PlanProgressTable";

const FY_OPTIONS = [2025, 2026, 2027];

// --- Filter / sort / group configuration ---

const SORT_OPTIONS = [
  { value: "name", label: "Plan Name" },
  { value: "totalRevenue", label: "Revenue" },
  { value: "totalTake", label: "Take" },
  { value: "owner", label: "Owner" },
  { value: "districtCount", label: "Districts" },
];

const GROUP_OPTIONS = [
  { value: "none", label: "No Grouping" },
  { value: "owner", label: "By Owner" },
  { value: "state", label: "By State" },
];

const CATEGORY_FILTER_OPTIONS = [
  { value: "renewal", label: "Renewal" },
  { value: "expansion", label: "Expansion" },
  { value: "winback", label: "Winback" },
  { value: "newBusiness", label: "New Business" },
];

// --- Helpers ---

function planHasCategoryActivity(plan: PlanProgress, category: string): boolean {
  const cat = category as keyof typeof CATEGORY_LABELS;
  return plan[cat].actual > 0 || plan[cat].target > 0;
}

function getPlanStates(plan: PlanProgress): string[] {
  return [...new Set(plan.districts.map((d) => d.stateAbbrev).filter(Boolean))] as string[];
}

export default function TeamProgressView() {
  const [fiscalYear, setFiscalYear] = useState(2026);
  const router = useRouter();
  const setActiveTab = useMapStore((s) => s.setActiveTab);

  const handlePlanClick = useCallback((planId: string) => {
    setActiveTab("plans");
    router.push(`/?tab=plans&plan=${planId}`);
  }, [setActiveTab, router]);

  const { data, isLoading, error } = useTeamProgress(fiscalYear);

  // Filter / sort / group state
  const [filters, setFilters] = useState<Record<string, string | string[]>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({
    field: "totalRevenue",
    direction: "desc",
  });
  const [groupBy, setGroupBy] = useState("none");

  // Build dynamic filter configs from data
  const filterConfigs: FilterConfig[] = useMemo(() => {
    if (!data) return [];

    const owners = [...new Set(data.plans.map((p) => p.owner?.fullName).filter(Boolean))] as string[];
    const states = [...new Set(data.plans.flatMap(getPlanStates))].sort();

    return [
      {
        id: "owner",
        label: "Owner",
        type: "select" as const,
        options: owners.map((o) => ({ value: o, label: o })),
      },
      {
        id: "category",
        label: "Category",
        type: "select" as const,
        options: CATEGORY_FILTER_OPTIONS,
      },
      {
        id: "state",
        label: "State",
        type: "select" as const,
        options: states.map((s) => ({ value: s, label: s })),
      },
    ];
  }, [data]);

  // Apply filters, search, sort to plans
  const processedPlans = useMemo(() => {
    if (!data) return [];

    let plans = [...data.plans];

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      plans = plans.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.owner?.fullName.toLowerCase().includes(q) ||
          p.districts.some((d) => d.name.toLowerCase().includes(q))
      );
    }

    // Filter: owner
    if (filters.owner && typeof filters.owner === "string") {
      plans = plans.filter((p) => p.owner?.fullName === filters.owner);
    }

    // Filter: category — only show plans with activity in selected category
    if (filters.category && typeof filters.category === "string") {
      plans = plans.filter((p) => planHasCategoryActivity(p, filters.category as string));
    }

    // Filter: state — only show plans with districts in selected state
    if (filters.state && typeof filters.state === "string") {
      plans = plans.filter((p) => getPlanStates(p).includes(filters.state as string));
    }

    // Sort
    plans.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "totalRevenue":
          cmp = a.total.actual - b.total.actual;
          break;
        case "totalTake":
          cmp = a.totalTake - b.totalTake;
          break;
        case "owner":
          cmp = (a.owner?.fullName || "").localeCompare(b.owner?.fullName || "");
          break;
        case "districtCount":
          cmp = a.districtCount - b.districtCount;
          break;
      }
      return sort.direction === "asc" ? cmp : -cmp;
    });

    return plans;
  }, [data, searchTerm, filters, sort]);

  // Group plans
  const groupedPlans = useMemo(() => {
    if (groupBy === "none") return new Map([["all", processedPlans]]);

    const groups = new Map<string, PlanProgress[]>();
    for (const plan of processedPlans) {
      let keys: string[];
      if (groupBy === "owner") {
        keys = [plan.owner?.fullName || "Unassigned"];
      } else if (groupBy === "state") {
        const states = getPlanStates(plan);
        keys = states.length > 0 ? states : ["No State"];
      } else {
        keys = ["all"];
      }

      for (const key of keys) {
        const existing = groups.get(key) || [];
        if (!existing.includes(plan)) existing.push(plan);
        groups.set(key, existing);
      }
    }

    return groups;
  }, [processedPlans, groupBy]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#403770]">Team Progress</h1>
            <p className="text-sm text-gray-500 mt-1">
              Revenue targets vs actuals across all territory plans
            </p>
          </div>
          <select
            value={fiscalYear}
            onChange={(e) => setFiscalYear(Number(e.target.value))}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-[#403770] font-medium focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
          >
            {FY_OPTIONS.map((fy) => (
              <option key={fy} value={fy}>
                FY{String(fy).slice(-2)}
              </option>
            ))}
          </select>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-32 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
            <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
            <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-12">
            <p className="text-red-500 text-sm">Failed to load team progress data.</p>
            <p className="text-gray-400 text-xs mt-1">Please try again later.</p>
          </div>
        )}

        {/* Empty state */}
        {data && data.plans.length === 0 && data.unmapped.districtCount === 0 && (
          <div className="text-center py-16">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-[#403770] font-medium">No territory plans for FY{String(fiscalYear).slice(-2)}</p>
            <p className="text-gray-400 text-sm mt-1">Create a plan and add district targets to see progress here.</p>
          </div>
        )}

        {/* Data loaded */}
        {data && (data.plans.length > 0 || data.unmapped.districtCount > 0) && (
          <>
            {/* Category Cards */}
            <div className="grid grid-cols-4 gap-4">
              <CategoryCard
                label={CATEGORY_LABELS.renewal}
                target={data.totals.renewal.target}
                actual={data.totals.renewal.actual}
                color={CATEGORY_COLORS.renewal}
              />
              <CategoryCard
                label={CATEGORY_LABELS.expansion}
                target={data.totals.expansion.target}
                actual={data.totals.expansion.actual}
                color={CATEGORY_COLORS.expansion}
              />
              <CategoryCard
                label={CATEGORY_LABELS.winback}
                target={data.totals.winback.target}
                actual={data.totals.winback.actual}
                color={CATEGORY_COLORS.winback}
              />
              <CategoryCard
                label={CATEGORY_LABELS.newBusiness}
                target={data.totals.newBusiness.target}
                actual={data.totals.newBusiness.actual}
                color={CATEGORY_COLORS.newBusiness}
              />
            </div>

            {/* Stacked Progress Bar */}
            <StackedProgressBar
              categories={[
                { label: CATEGORY_LABELS.renewal, actual: data.totals.renewal.actual, color: CATEGORY_COLORS.renewal },
                { label: CATEGORY_LABELS.expansion, actual: data.totals.expansion.actual, color: CATEGORY_COLORS.expansion },
                { label: CATEGORY_LABELS.winback, actual: data.totals.winback.actual, color: CATEGORY_COLORS.winback },
                { label: CATEGORY_LABELS.newBusiness, actual: data.totals.newBusiness.actual, color: CATEGORY_COLORS.newBusiness },
              ]}
              totalTarget={data.totals.combined.target}
            />

            {/* Unmapped Alert */}
            <UnmappedAlert
              totalRevenue={data.unmapped.totalRevenue}
              districtCount={data.unmapped.districtCount}
            />

            {/* Filter Bar */}
            <FilterBar
              filters={filterConfigs}
              activeFilters={filters}
              onFilterChange={setFilters}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              sortOptions={SORT_OPTIONS}
              currentSort={sort}
              onSortChange={setSort}
              groupOptions={GROUP_OPTIONS}
              currentGroup={groupBy}
              onGroupChange={setGroupBy}
              savedViews={[]}
              onSaveView={() => {}}
              onLoadView={() => {}}
              onDeleteView={() => {}}
            />

            {/* Plan Drill-down Table — grouped */}
            {groupBy === "none" ? (
              <PlanProgressTable
                plans={processedPlans}
                unmapped={data.unmapped}
                onPlanClick={handlePlanClick}
              />
            ) : (
              <div className="space-y-6">
                {Array.from(groupedPlans.entries()).map(([group, plans]) => (
                  <div key={group}>
                    <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#F37167]" />
                      {group}
                      <span className="text-gray-400 font-normal">({plans.length})</span>
                    </h3>
                    <PlanProgressTable
                      plans={plans}
                      unmapped={{ totalRevenue: 0, totalTake: 0, districtCount: 0, districts: [] }}
                      onPlanClick={handlePlanClick}
                    />
                  </div>
                ))}
                {/* Show unmapped once at the bottom */}
                {data.unmapped.districtCount > 0 && (
                  <PlanProgressTable
                    plans={[]}
                    unmapped={data.unmapped}
                    onPlanClick={handlePlanClick}
                  />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
