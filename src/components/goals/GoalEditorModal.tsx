"use client";

import { useState, useEffect } from "react";
import { useUpsertUserGoal } from "@/lib/api";

// Parse currency string to number (handles $, commas, etc.)
function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Tooltip with info icon - shows explanation on hover
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

// Constants for goal calculations (matching Fullmind's comp structure)
export const BASE_SALARY = 130000;
export const COMMISSION_RATE = 0.10; // 10% of take
export const PIPELINE_MULTIPLIER = 5; // 5x pipeline to revenue

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

export default function GoalEditorModal({ isOpen, onClose, fiscalYear, currentGoals }: GoalEditorModalProps) {
  const upsertGoalMutation = useUpsertUserGoal();

  // User inputs - these drive the calculated goals
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

  // Calculate derived goals from user inputs
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
