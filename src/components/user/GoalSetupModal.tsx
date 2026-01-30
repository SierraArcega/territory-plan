"use client";

import { useState } from "react";
import { useProfile, useUpdateProfile, useUpsertUserGoal } from "@/lib/api";

// Available fiscal years for goal setting
const FISCAL_YEARS = [2026, 2027, 2028, 2029];

// Parse a currency string to number
function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Tooltip component - positions to the right to avoid container overflow
function Tooltip({ text }: { text: string }) {
  return (
    <div className="group relative inline-block ml-1">
      <svg
        className="w-4 h-4 text-[#403770]/50 hover:text-[#403770]/70 cursor-help inline"
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
      <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-[#403770] text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 w-56 z-10 whitespace-normal">
        {text}
        <div className="absolute top-full left-3 border-4 border-transparent border-t-[#403770]" />
      </div>
    </div>
  );
}

export default function GoalSetupModal() {
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const upsertGoalMutation = useUpsertUserGoal();

  // Form state for goals
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [earningsTarget, setEarningsTarget] = useState("");
  const [takeTarget, setTakeTarget] = useState("");
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
        earningsTarget || takeTarget || newDistrictsTarget;

      if (hasGoals) {
        await upsertGoalMutation.mutateAsync({
          fiscalYear,
          earningsTarget: parseCurrency(earningsTarget),
          takeTarget: parseCurrency(takeTarget),
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
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#403770]/40" />

      {/* Modal */}
      <div className="relative bg-[#FFFCFA] rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header with welcome message - Robin's Egg background */}
        <div className="px-6 py-5 bg-[#C4E7E6]">
          <h2 className="text-xl font-bold text-[#403770]">
            Welcome to Territory Plan Builder!
          </h2>
          <p className="mt-1 text-[#403770]/70 text-sm">
            Hey {displayName}, let&apos;s set up your goals to track your progress.
          </p>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <p className="text-sm text-[#403770]/70">
            Select a fiscal year and enter your targets. You can always update these
            later from your profile, or add goals for additional years.
          </p>

          {/* Fiscal Year Selector */}
          <div>
            <label className="block text-sm font-medium text-[#403770] mb-1">
              Fiscal Year
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            >
              {FISCAL_YEARS.map((year) => (
                <option key={year} value={year}>
                  FY{year.toString().slice(-2)} ({year - 1}-{year})
                </option>
              ))}
            </select>
          </div>

          {/* Target Total Earnings */}
          <div>
            <label className="block text-sm font-medium text-[#403770] mb-1">
              Target Total Earnings
              <Tooltip text="How much you want to make this year." />
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#403770]/50">
                $
              </span>
              <input
                type="text"
                value={earningsTarget}
                onChange={(e) => setEarningsTarget(e.target.value)}
                placeholder="150,000"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />
            </div>
          </div>

          {/* Take Goal */}
          <div>
            <label className="block text-sm font-medium text-[#403770] mb-1">
              Take Goal
              <Tooltip text="Your target profit contribution after direct costs." />
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#403770]/50">
                $
              </span>
              <input
                type="text"
                value={takeTarget}
                onChange={(e) => setTakeTarget(e.target.value)}
                placeholder="75,000"
                className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
              />
            </div>
          </div>

          {/* New Districts */}
          <div>
            <label className="block text-sm font-medium text-[#403770] mb-1">
              New Districts
              <Tooltip text="Number of new district logos (first-time customers) to win." />
            </label>
            <input
              type="number"
              value={newDistrictsTarget}
              onChange={(e) => setNewDistrictsTarget(e.target.value)}
              placeholder="10"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#C4E7E6]/30 border-t border-[#C4E7E6] flex justify-between">
          <button
            type="button"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium text-[#403770]/70 hover:text-[#403770] transition-colors disabled:opacity-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting}
            className="px-6 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e05f55] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Saving..." : "Save Goals"}
          </button>
        </div>
      </div>
    </div>
  );
}
