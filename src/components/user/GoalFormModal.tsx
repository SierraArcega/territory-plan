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
  revenueTarget: number | null;
  takeTarget: number | null;
  pipelineTarget: number | null;
  newDistrictsTarget: number | null;
  drawDownTarget: number | null;
  quotaTarget: number | null;
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

export default function GoalFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = "Set Goals",
  isNewGoal = false,
}: GoalFormModalProps) {
  const [fiscalYear, setFiscalYear] = useState(initialData?.fiscalYear || 2026);
  const [revenueTarget, setRevenueTarget] = useState("");
  const [takeTarget, setTakeTarget] = useState("");
  const [pipelineTarget, setPipelineTarget] = useState("");
  const [newDistrictsTarget, setNewDistrictsTarget] = useState("");
  const [drawDownTarget, setDrawDownTarget] = useState("");
  const [quotaTarget, setQuotaTarget] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFiscalYear(initialData?.fiscalYear || 2026);
      setRevenueTarget(formatForInput(initialData?.revenueTarget));
      setTakeTarget(formatForInput(initialData?.takeTarget));
      setPipelineTarget(formatForInput(initialData?.pipelineTarget));
      setNewDistrictsTarget(formatForInput(initialData?.newDistrictsTarget));
      setDrawDownTarget(formatForInput(initialData?.drawDownTarget));
      setQuotaTarget(formatForInput(initialData?.quotaTarget));
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
        revenueTarget: parseCurrency(revenueTarget),
        takeTarget: parseCurrency(takeTarget),
        pipelineTarget: parseCurrency(pipelineTarget),
        newDistrictsTarget: newDistrictsTarget
          ? parseInt(newDistrictsTarget, 10)
          : null,
        drawDownTarget: parseCurrency(drawDownTarget),
        quotaTarget: parseCurrency(quotaTarget),
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
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
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
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fiscal Year <span className="text-red-500">*</span>
                </label>
                <select
                  value={fiscalYear}
                  onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                >
                  {FISCAL_YEARS.map((year) => (
                    <option key={year} value={year}>
                      FY{year.toString().slice(-2)} ({year - 1}-{year})
                    </option>
                  ))}
                </select>
              </div>
            )}

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
                  ref={inputRef}
                  type="text"
                  value={revenueTarget}
                  onChange={(e) => setRevenueTarget(e.target.value)}
                  placeholder="500,000"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Total net invoicing goal
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
                Gross margin goal from sessions
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
              <p className="mt-1 text-xs text-gray-500">Open pipeline goal</p>
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

            {/* Draw Down Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Draw Down
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  value={drawDownTarget}
                  onChange={(e) => setDrawDownTarget(e.target.value)}
                  placeholder="100,000"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Your draw down amount
              </p>
            </div>

            {/* Quota Target */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quota
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="text"
                  value={quotaTarget}
                  onChange={(e) => setQuotaTarget(e.target.value)}
                  placeholder="500,000"
                  className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Your quota target
              </p>
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
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Save Goals"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
