"use client";

import { useState } from "react";
import { useGoalDashboard } from "@/lib/api";
import { useMapStore } from "@/lib/store";
import ProgressCard, { formatCurrency, getDefaultFiscalYear } from "@/features/goals/components/ProgressCard";
import GoalEditorModal from "@/features/goals/components/GoalEditorModal";

const FISCAL_YEARS = [2025, 2026, 2027, 2028, 2029];

// ============================================================================
// GoalsView - Main goals dashboard component
// ============================================================================

export default function GoalsView() {
  const [selectedYear, setSelectedYear] = useState(getDefaultFiscalYear());
  const [showGoalEditor, setShowGoalEditor] = useState(false);
  const { data: dashboard, isLoading, error } = useGoalDashboard(selectedYear);

  // Get setActiveTab for navigation
  const setActiveTab = useMapStore((state) => state.setActiveTab);

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#403770]">Goals Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track your targets and plan progress
            </p>
          </div>
          <button
            onClick={() => setActiveTab("plans")}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Plans
          </button>
        </div>
      </header>

      {/* Fiscal Year Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1">
            {FISCAL_YEARS.map((year) => (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                className={`px-4 py-3 text-sm font-medium transition-colors relative ${
                  selectedYear === year
                    ? "text-[#403770]"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                FY{String(year).slice(-2)}
                {selectedYear === year && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-20 text-red-500">
            <p>Failed to load dashboard</p>
          </div>
        ) : dashboard ? (
          <div className="space-y-8">
            {/* User Goals Section */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#403770]">
                  Your FY{String(selectedYear).slice(-2)} Goals
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowGoalEditor(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {dashboard.goals ? "Edit Goals" : "Set Goals"}
                  </button>
                </div>
              </div>
              {dashboard.goals ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <ProgressCard
                      label="Earnings"
                      current={dashboard.actuals.earnings}
                      target={dashboard.goals.earningsTarget}
                      color="#F37167"
                    />
                    <ProgressCard
                      label="Take"
                      current={dashboard.actuals.take}
                      target={dashboard.goals.takeTarget}
                      color="#6EA3BE"
                    />
                    <ProgressCard
                      label="Total Target"
                      current={dashboard.actuals.revenue + dashboard.actuals.pipeline}
                      target={(dashboard.goals?.renewalTarget || 0) + (dashboard.goals?.winbackTarget || 0) + (dashboard.goals?.expansionTarget || 0) + (dashboard.goals?.newBusinessTarget || 0)}
                      color="#403770"
                    />
                    <ProgressCard
                      label="New Districts"
                      current={dashboard.actuals.newDistricts}
                      target={dashboard.goals.newDistrictsTarget}
                      format="number"
                      color="#403770"
                    />
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-300 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p className="text-gray-500 mb-4">
                    No goals set for FY{String(selectedYear).slice(-2)} yet
                  </p>
                  <button
                    onClick={() => setShowGoalEditor(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Set Your Goals
                  </button>
                </div>
              )}
            </section>

            {/* Plan Targets Summary */}
            <section>
              <h2 className="text-lg font-semibold text-[#403770] mb-4">
                Plan Targets Summary
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Plans</p>
                    <p className="text-2xl font-bold text-[#403770]">
                      {dashboard.planTotals.planCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Districts</p>
                    <p className="text-2xl font-bold text-[#403770]">
                      {dashboard.planTotals.districtCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Total Target</p>
                    <p className="text-2xl font-bold text-[#403770]">
                      {formatCurrency(dashboard.planTotals.totalTarget)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Plans List */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#403770]">
                  FY{String(selectedYear).slice(-2)} Plans
                </h2>
                <button
                  onClick={() => setActiveTab("plans")}
                  className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                >
                  View all plans →
                </button>
              </div>

              {dashboard.plans.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.plans.map((plan) => (
                    <button
                      key={plan.id}
                      onClick={() => setActiveTab("plans")}
                      className="block w-full text-left bg-white rounded-lg border border-gray-200 p-4 hover:border-[#403770] transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className="w-4 h-4 rounded-full flex-shrink-0"
                            style={{ backgroundColor: plan.color }}
                          />
                          <div>
                            <h3 className="font-medium text-[#403770]">{plan.name}</h3>
                            <p className="text-sm text-gray-500">
                              {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-gray-700">
                            {formatCurrency(plan.totalTarget)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Total target
                          </p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <svg
                    className="w-12 h-12 mx-auto text-gray-300 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                  <p className="text-gray-500 mb-4">
                    No plans for FY{String(selectedYear).slice(-2)} yet
                  </p>
                  <button
                    onClick={() => setActiveTab("plans")}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create a Plan
                  </button>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>

      {/* Goal Editor Modal */}
      <GoalEditorModal
        isOpen={showGoalEditor}
        onClose={() => setShowGoalEditor(false)}
        fiscalYear={selectedYear}
        currentGoals={dashboard?.goals || null}
      />
    </div>
  );
}
