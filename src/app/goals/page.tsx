"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useGoalDashboard, useProfile, useUpsertUserGoal } from "@/lib/api";

// Get default fiscal year based on current date
function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}

const FISCAL_YEARS = [2025, 2026, 2027, 2028, 2029];

function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "-";
  if (compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
  }
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
  const formattedCurrent = format === "currency" ? formatCurrency(current, true) : current.toLocaleString();
  const formattedTarget = format === "currency" ? formatCurrency(target, true) : (target?.toLocaleString() || "-");
  const percent = target && target > 0 ? Math.min((current / target) * 100, 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 min-h-[120px] flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        {target !== null && target !== undefined && (
          <span className="text-xs font-semibold" style={{ color }}>
            {formatPercent(current, target)}
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center">
        <div className="text-xl font-bold text-[#403770] leading-tight">{formattedCurrent}</div>
        <div className="text-xs text-gray-400 mt-0.5">of {formattedTarget}</div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// Parse a currency string to number
function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Tooltip component - positions to the right to avoid container clipping
function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block ml-1">
      <svg
        className="w-4 h-4 text-gray-400 hover:text-gray-600 cursor-help inline"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[#403770] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-50 whitespace-normal">
        {text}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-[#403770]" />
      </div>
    </div>
  );
}

// Constants for goal calculations
const BASE_SALARY = 130000;
const COMMISSION_RATE = 0.10; // 10% of take
const PIPELINE_MULTIPLIER = 5; // 5x pipeline to revenue

interface GoalEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiscalYear: number;
  currentGoals: {
    earningsTarget: number | null;
    takeRatePercent: number | null;
    revenueTarget: number | null;
    takeTarget: number | null;
    pipelineTarget: number | null;
    newDistrictsTarget: number | null;
  } | null;
}

function GoalEditorModal({ isOpen, onClose, fiscalYear, currentGoals }: GoalEditorModalProps) {
  const upsertGoalMutation = useUpsertUserGoal();

  // User inputs
  const [earningsTarget, setEarningsTarget] = useState("");
  const [takeRatePercent, setTakeRatePercent] = useState("");
  const [newDistrictsTarget, setNewDistrictsTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens or goals change
  useEffect(() => {
    if (isOpen && currentGoals) {
      setEarningsTarget(currentGoals.earningsTarget?.toLocaleString() || "");
      setTakeRatePercent(currentGoals.takeRatePercent?.toString() || "");
      setNewDistrictsTarget(currentGoals.newDistrictsTarget?.toString() || "");
    } else if (isOpen) {
      setEarningsTarget("");
      setTakeRatePercent("");
      setNewDistrictsTarget("");
    }
    setError(null);
  }, [isOpen, currentGoals]);

  // Calculate derived goals
  const earnings = parseCurrency(earningsTarget);
  const takeRate = parseFloat(takeRatePercent) || 0;

  // Required Take = (Target Earnings - Base Salary) / Commission Rate
  const calculatedTake = earnings && earnings > BASE_SALARY
    ? (earnings - BASE_SALARY) / COMMISSION_RATE
    : null;

  // Required Revenue = Take / Take Rate %
  const calculatedRevenue = calculatedTake && takeRate > 0
    ? calculatedTake / (takeRate / 100)
    : null;

  // Required Pipeline = Revenue × 5
  const calculatedPipeline = calculatedRevenue
    ? calculatedRevenue * PIPELINE_MULTIPLIER
    : null;

  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await upsertGoalMutation.mutateAsync({
        fiscalYear,
        earningsTarget: earnings,
        takeRatePercent: takeRate || null,
        takeTarget: calculatedTake,
        revenueTarget: calculatedRevenue,
        pipelineTarget: calculatedPipeline,
        newDistrictsTarget: newDistrictsTarget ? parseInt(newDistrictsTarget, 10) : null,
      });
      onClose();
    } catch (err) {
      console.error("Error saving goals:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#403770]">
              FY{String(fiscalYear).slice(-2)} Goals
            </h2>
            <p className="text-sm text-gray-500">Set your targets for this fiscal year</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Section: Your Inputs */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[#403770] uppercase tracking-wide">Your Inputs</h3>

            {/* Target Total Earnings */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Target Total Earnings
                <Tooltip text="How much you want to make this year (base salary + commissions)." />
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                <input
                  type="text"
                  value={earningsTarget}
                  onChange={(e) => setEarningsTarget(e.target.value)}
                  placeholder="180,000"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-400 mt-1">Base salary: ${BASE_SALARY.toLocaleString()}</p>
            </div>

            {/* Average Take Rate */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Average Take Rate
                <Tooltip text="Expected percentage of revenue that becomes take (profit margin). Typical range: 15-25%." />
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={takeRatePercent}
                  onChange={(e) => setTakeRatePercent(e.target.value)}
                  placeholder="20"
                  min="1"
                  max="100"
                  step="0.5"
                  className="w-full pr-8 pl-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
              </div>
            </div>

            {/* New Districts */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Districts Target
                <Tooltip text="Number of new district logos (first-time customers) to win." />
              </label>
              <input
                type="number"
                value={newDistrictsTarget}
                onChange={(e) => setNewDistrictsTarget(e.target.value)}
                placeholder="10"
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200" />

          {/* Section: Calculated Goals */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-[#403770] uppercase tracking-wide">Calculated Goals</h3>

            {earnings && earnings <= BASE_SALARY ? (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg">
                Target earnings must exceed base salary (${BASE_SALARY.toLocaleString()}) to calculate commission-based goals.
              </p>
            ) : !earnings || !takeRate ? (
              <p className="text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                Enter your target earnings and take rate to see calculated goals.
              </p>
            ) : (
              <div className="bg-[#C4E7E6]/30 rounded-lg p-4 space-y-3">
                {/* Required Take */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-600">Required Take</span>
                    <p className="text-xs text-gray-400">
                      (${earnings?.toLocaleString()} - ${BASE_SALARY.toLocaleString()}) ÷ {(COMMISSION_RATE * 100)}%
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-[#403770]">
                    ${calculatedTake?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* Required Revenue */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-600">Required Revenue</span>
                    <p className="text-xs text-gray-400">
                      ${calculatedTake?.toLocaleString(undefined, { maximumFractionDigits: 0 })} ÷ {takeRate}%
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-[#403770]">
                    ${calculatedRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>

                {/* Required Pipeline */}
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-sm text-gray-600">Required Pipeline</span>
                    <p className="text-xs text-gray-400">
                      ${calculatedRevenue?.toLocaleString(undefined, { maximumFractionDigits: 0 })} × {PIPELINE_MULTIPLIER}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-[#403770]">
                    ${calculatedPipeline?.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !earnings}
            className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Goals"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GoalsDashboardPage() {
  const [selectedYear, setSelectedYear] = useState(getDefaultFiscalYear());
  const [showGoalEditor, setShowGoalEditor] = useState(false);
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
                  <Tooltip text="Set your target earnings and take rate, and we'll calculate the take, revenue, and pipeline you need to hit your goal." />
                </div>
              </div>
              {dashboard.goals ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                      label="Revenue"
                      current={dashboard.actuals.revenue}
                      target={dashboard.goals.revenueTarget}
                      color="#8AA891"
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
