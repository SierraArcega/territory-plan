"use client";

import { useState, useEffect, useRef } from "react";
import type { UserGoal } from "@/lib/api";

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GoalFormData) => Promise<void>;
  initialData?: Partial<UserGoal>;
  title?: string;
  isNewGoal?: boolean;
}

export interface GoalFormData {
  fiscalYear: number;
  earningsTarget: number | null;
  takeTarget: number | null;
  newDistrictsTarget: number | null;
}

// Available fiscal years for goal creation
const FISCAL_YEARS = [2025, 2026, 2027, 2028, 2029];

// Parse a currency string to number
function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[^0-9.-]/g, "");
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Format a number for input display
function formatForInput(value: number | null | undefined): string {
  if (value === null || value === undefined || value === 0) return "";
  return value.toString();
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

export default function GoalFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = "Set Goals",
  isNewGoal = false,
}: GoalFormModalProps) {
  const [fiscalYear, setFiscalYear] = useState(initialData?.fiscalYear || 2026);
  const [earningsTarget, setEarningsTarget] = useState("");
  const [takeTarget, setTakeTarget] = useState("");
  const [newDistrictsTarget, setNewDistrictsTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFiscalYear(initialData?.fiscalYear || 2026);
      setEarningsTarget(formatForInput(initialData?.earningsTarget));
      setTakeTarget(formatForInput(initialData?.takeTarget));
      setNewDistrictsTarget(formatForInput(initialData?.newDistrictsTarget));
      setError(null);
      // Focus first input after a short delay for animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        fiscalYear,
        earningsTarget: parseCurrency(earningsTarget),
        takeTarget: parseCurrency(takeTarget),
        newDistrictsTarget: newDistrictsTarget
          ? parseInt(newDistrictsTarget, 10)
          : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goals");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#403770]/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-[#FFFCFA] rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-[#C4E7E6] flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-[#403770]/10 text-[#403770]/60 hover:text-[#403770] transition-colors"
          >
            <svg
              className="w-5 h-5"
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
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Fiscal Year Selector - only show for new goals */}
            {isNewGoal && (
              <div>
                <label className="block text-sm font-medium text-[#403770] mb-1">
                  Fiscal Year <span className="text-[#F37167]">*</span>
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
            )}

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
                  ref={inputRef}
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
          <div className="px-6 py-4 bg-[#C4E7E6]/30 border-t border-[#C4E7E6] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#403770]/70 hover:text-[#403770] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e05f55] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Goals"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
