"use client";

import { useState } from "react";
import { useTeamProgress } from "../lib/queries";
import { CATEGORY_COLORS, CATEGORY_LABELS } from "../lib/types";
import CategoryCard from "./CategoryCard";
import StackedProgressBar from "./StackedProgressBar";
import UnmappedAlert from "./UnmappedAlert";
import PlanProgressTable from "./PlanProgressTable";

const FY_OPTIONS = [2025, 2026, 2027];

export default function TeamProgressView() {
  const [fiscalYear, setFiscalYear] = useState(2026);
  const { data, isLoading, error } = useTeamProgress(fiscalYear);

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

            {/* Plan Drill-down Table */}
            <PlanProgressTable
              plans={data.plans}
              unmapped={data.unmapped}
            />
          </>
        )}
      </div>
    </div>
  );
}
