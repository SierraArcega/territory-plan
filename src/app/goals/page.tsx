"use client";

import { useState } from "react";
import Link from "next/link";
import { useGoalDashboard, useProfile } from "@/lib/api";

// Get default fiscal year based on current date
function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

const FISCAL_YEARS = [2025, 2026, 2027, 2028, 2029];

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPercent(current: number, target: number | null): string {
  if (!target || target === 0) return "-";
  const percent = (current / target) * 100;
  return `${Math.round(percent)}%`;
}

interface ProgressCardProps {
  label: string;
  current: number;
  target: number | null;
  format?: "currency" | "number";
  color: string;
}

function ProgressCard({ label, current, target, format = "currency", color }: ProgressCardProps) {
  const formattedCurrent = format === "currency" ? formatCurrency(current) : current.toLocaleString();
  const formattedTarget = format === "currency" ? formatCurrency(target) : (target?.toLocaleString() || "-");
  const percent = target && target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-600">{label}</span>
        {target && (
          <span className="text-sm font-semibold" style={{ color }}>
            {formatPercent(current, target)}
          </span>
        )}
      </div>
      <div className="mb-3">
        <span className="text-2xl font-bold text-[#403770]">{formattedCurrent}</span>
        <span className="text-sm text-gray-400 ml-2">/ {formattedTarget}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function GoalsDashboardPage() {
  const [selectedYear, setSelectedYear] = useState(getDefaultFiscalYear());
  const { data: profile } = useProfile();
  const { data: dashboard, isLoading, error } = useGoalDashboard(selectedYear);

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#403770]">Goals Dashboard</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Track your targets and plan progress
            </p>
          </div>
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            View Plans
          </Link>
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
            {dashboard.goals ? (
              <section>
                <h2 className="text-lg font-semibold text-[#403770] mb-4">
                  Your FY{String(selectedYear).slice(-2)} Goals
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <ProgressCard
                    label="Revenue"
                    current={dashboard.actuals.revenue}
                    target={dashboard.goals.revenueTarget}
                    color="#8AA891"
                  />
                  <ProgressCard
                    label="Take"
                    current={dashboard.actuals.take}
                    target={dashboard.goals.takeTarget}
                    color="#6EA3BE"
                  />
                  <ProgressCard
                    label="Pipeline"
                    current={dashboard.actuals.pipeline}
                    target={dashboard.goals.pipelineTarget}
                    color="#D4A84B"
                  />
                  <ProgressCard
                    label="New Districts"
                    current={dashboard.actuals.newDistricts}
                    target={dashboard.goals.newDistrictsTarget}
                    format="number"
                    color="#F37167"
                  />
                </div>
              </section>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800">
                <p>
                  No goals set for FY{String(selectedYear).slice(-2)}.{" "}
                  <Link href="/setup" className="text-[#403770] font-medium hover:underline">
                    Set your goals
                  </Link>
                </p>
              </div>
            )}

            {/* Plan Targets Summary */}
            <section>
              <h2 className="text-lg font-semibold text-[#403770] mb-4">
                Plan Targets Summary
              </h2>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
                    <p className="text-sm text-gray-500 mb-1">Revenue Target</p>
                    <p className="text-2xl font-bold text-[#403770]">
                      {formatCurrency(dashboard.planTotals.revenueTarget)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">Pipeline Target</p>
                    <p className="text-2xl font-bold text-[#403770]">
                      {formatCurrency(dashboard.planTotals.pipelineTarget)}
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
                <Link
                  href="/plans"
                  className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                >
                  View all plans →
                </Link>
              </div>

              {dashboard.plans.length > 0 ? (
                <div className="space-y-3">
                  {dashboard.plans.map((plan) => (
                    <Link
                      key={plan.id}
                      href={`/plans/${plan.id}`}
                      className="block bg-white rounded-lg border border-gray-200 p-4 hover:border-[#403770] transition-colors"
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
                            {formatCurrency(plan.revenueTarget)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Pipeline: {formatCurrency(plan.pipelineTarget)}
                          </p>
                        </div>
                      </div>
                    </Link>
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
                  <Link
                    href="/plans"
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Create a Plan
                  </Link>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </main>
    </div>
  );
}
