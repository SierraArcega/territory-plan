"use client";

import { useState } from "react";
import { useProfile, useUpdateProfile, useUpsertUserGoal } from "@/lib/api";

// Current fiscal year - can be updated as needed
const CURRENT_FISCAL_YEAR = 2026;

// Format a number as currency for display
function formatCurrency(value: number | null): string {
  if (value === null || value === 0) return "";
  return value.toString();
}

// Parse a currency string to number
function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export default function GoalSetupModal() {
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const upsertGoalMutation = useUpsertUserGoal();

  // Form state for FY26 goals
  const [revenueTarget, setRevenueTarget] = useState("");
  const [takeTarget, setTakeTarget] = useState("");
  const [pipelineTarget, setPipelineTarget] = useState("");
  const [newDistrictsTarget, setNewDistrictsTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Don't show if profile not loaded or setup already completed
  if (!profile || profile.hasCompletedSetup) {
    return null;
  }

  const displayName = profile.fullName || profile.email.split("@")[0];

  // Handle skip - just mark setup as complete without saving goals
  const handleSkip = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      await updateProfileMutation.mutateAsync({ hasCompletedSetup: true });
    } catch (err) {
      console.error("Error skipping setup:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle save - save goals and mark setup as complete
  const handleSave = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Save the goals if any values were entered
      const hasGoals =
        revenueTarget || takeTarget || pipelineTarget || newDistrictsTarget;

      if (hasGoals) {
        await upsertGoalMutation.mutateAsync({
          fiscalYear: CURRENT_FISCAL_YEAR,
          revenueTarget: parseCurrency(revenueTarget),
          takeTarget: parseCurrency(takeTarget),
          pipelineTarget: parseCurrency(pipelineTarget),
          newDistrictsTarget: newDistrictsTarget
            ? parseInt(newDistrictsTarget, 10)
            : null,
        });
      }

      // Mark setup as complete
      await updateProfileMutation.mutateAsync({ hasCompletedSetup: true });
    } catch (err) {
      console.error("Error saving goals:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop - darker to draw attention */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header with welcome message */}
        <div className="px-6 py-5 bg-gradient-to-r from-[#403770] to-[#5a4a9a] text-white">
          <h2 className="text-xl font-semibold">
            Welcome to Territory Plan Builder!
          </h2>
          <p className="mt-1 text-white/80 text-sm">
            Hey {displayName}, let&apos;s set up your FY{CURRENT_FISCAL_YEAR.toString().slice(-2)} goals to track your progress.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-600">
            Enter your targets for this fiscal year. You can always update these
            later from your profile.
          </p>

          {/* Revenue Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Revenue Target
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                value={revenueTarget}
                onChange={(e) => setRevenueTarget(e.target.value)}
                placeholder="500,000"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Your total net invoicing goal for FY{CURRENT_FISCAL_YEAR.toString().slice(-2)}
            </p>
          </div>

          {/* Take/Margin Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Take (Gross Margin) Target
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                value={takeTarget}
                onChange={(e) => setTakeTarget(e.target.value)}
                placeholder="75,000"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Your gross margin goal from sessions
            </p>
          </div>

          {/* Pipeline Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipeline Target
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                value={pipelineTarget}
                onChange={(e) => setPipelineTarget(e.target.value)}
                placeholder="1,000,000"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Your open pipeline goal
            </p>
          </div>

          {/* New Districts Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Districts Target
            </label>
            <input
              type="number"
              value={newDistrictsTarget}
              onChange={(e) => setNewDistrictsTarget(e.target.value)}
              placeholder="10"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Number of new districts to acquire
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-between">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Goals"}
          </button>
        </div>
      </div>
    </div>
  );
}
