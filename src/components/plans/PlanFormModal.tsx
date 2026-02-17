"use client";

import { useState, useEffect, useRef } from "react";
import type { TerritoryPlan } from "@/lib/api";
import { useUsers, useStates } from "@/lib/api";

interface PlanFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PlanFormData) => Promise<void>;
  initialData?: Partial<TerritoryPlan>;
  title?: string;
}

export interface PlanFormData {
  name: string;
  description: string;
  ownerId: string | null;
  color: string;
  status: "planning" | "working" | "stale" | "archived";
  fiscalYear: number;
  startDate: string;
  endDate: string;
  stateFips: string[];
  collaboratorIds: string[];
}

const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

// Fiscal year options - show FY25 through FY29
const FISCAL_YEAR_OPTIONS = [
  { value: 2025, label: "FY25 (Jul 2024 - Jun 2025)" },
  { value: 2026, label: "FY26 (Jul 2025 - Jun 2026)" },
  { value: 2027, label: "FY27 (Jul 2026 - Jun 2027)" },
  { value: 2028, label: "FY28 (Jul 2027 - Jun 2028)" },
  { value: 2029, label: "FY29 (Jul 2028 - Jun 2029)" },
];

// Get default fiscal year based on current date
function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const year = now.getFullYear();
  // Fiscal year starts in July (month 6)
  // If we're in Jul-Dec, we're in the FY that ends next year
  // If we're in Jan-Jun, we're in the FY that ends this year
  return month >= 6 ? year + 1 : year;
}

export default function PlanFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title = "Create Territory Plan",
}: PlanFormModalProps) {
  const [formData, setFormData] = useState<PlanFormData>({
    name: "",
    description: "",
    ownerId: null,
    color: PLAN_COLORS[0].value,
    status: "planning",
    fiscalYear: getDefaultFiscalYear(),
    startDate: "",
    endDate: "",
    stateFips: [],
    collaboratorIds: [],
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showStateDropdown, setShowStateDropdown] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: users } = useUsers();
  const { data: allStates } = useStates();

  // Reset form when modal opens/closes or initialData changes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialData?.name || "",
        description: initialData?.description || "",
        ownerId: initialData?.owner?.id ?? null,
        color: initialData?.color || PLAN_COLORS[0].value,
        status: initialData?.status || "planning",
        fiscalYear: initialData?.fiscalYear || getDefaultFiscalYear(),
        startDate: initialData?.startDate?.split("T")[0] || "",
        endDate: initialData?.endDate?.split("T")[0] || "",
        stateFips: initialData?.states?.map((s) => s.fips) ?? [],
        collaboratorIds: initialData?.collaborators?.map((c) => c.id) ?? [],
      });
      setError(null);
      // Focus input after a short delay for animation
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError("Plan name is required");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save plan");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
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
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Plan Name <span className="text-red-500">*</span>
              </label>
              <input
                ref={inputRef}
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Q1 2025 Northeast Expansion"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              />
            </div>

            {/* Fiscal Year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fiscal Year <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.fiscalYear}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    fiscalYear: parseInt(e.target.value, 10),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              >
                {FISCAL_YEAR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this territory plan..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent resize-none"
              />
            </div>

            {/* Color */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Color
              </label>
              <div className="flex gap-2">
                {PLAN_COLORS.map((color) => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: color.value })}
                    className={`w-8 h-8 rounded-full transition-all ${
                      formData.color === color.value
                        ? "ring-2 ring-offset-2 ring-[#403770]"
                        : "hover:scale-110"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    status: e.target.value as "planning" | "working" | "stale" | "archived",
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Owner
              </label>
              <select
                value={formData.ownerId ?? ""}
                onChange={(e) => setFormData({ ...formData, ownerId: e.target.value || null })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              >
                <option value="">Unassigned</option>
                {users?.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName || u.email}
                  </option>
                ))}
              </select>
            </div>

            {/* States */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                States
              </label>
              {formData.stateFips.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {formData.stateFips.map((fips) => {
                    const state = allStates?.find((s) => s.fips === fips);
                    return (
                      <span
                        key={fips}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
                      >
                        {state?.abbrev || fips}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, stateFips: formData.stateFips.filter((f) => f !== fips) })}
                          className="hover:text-red-500 leading-none"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowStateDropdown(!showStateDropdown)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent text-gray-500 text-left"
                >
                  {formData.stateFips.length === 0 ? "Select states..." : `${formData.stateFips.length} selected`}
                </button>
                {showStateDropdown && (
                  <div className="absolute z-10 mt-1 w-full max-h-36 overflow-y-auto bg-white border border-gray-200 rounded-lg shadow-lg">
                    {allStates?.map((state) => (
                      <label
                        key={state.fips}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={formData.stateFips.includes(state.fips)}
                          onChange={(e) => {
                            const newFips = e.target.checked
                              ? [...formData.stateFips, state.fips]
                              : formData.stateFips.filter((f) => f !== state.fips);
                            setFormData({ ...formData, stateFips: newFips });
                          }}
                          className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]/20"
                        />
                        {state.abbrev} — {state.name}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Collaborators */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Collaborators
              </label>
              {formData.collaboratorIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {formData.collaboratorIds.map((uid) => {
                    const user = users?.find((u) => u.id === uid);
                    return (
                      <span
                        key={uid}
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-50 text-purple-700 rounded-full text-xs font-medium"
                      >
                        {user?.fullName || user?.email || "Unknown"}
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, collaboratorIds: formData.collaboratorIds.filter((id) => id !== uid) })}
                          className="hover:text-red-500 leading-none"
                        >
                          &times;
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !formData.collaboratorIds.includes(e.target.value)) {
                    setFormData({ ...formData, collaboratorIds: [...formData.collaboratorIds, e.target.value] });
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent text-gray-500"
              >
                <option value="">Add collaborator...</option>
                {users
                  ?.filter((u) => !formData.collaboratorIds.includes(u.id) && u.id !== formData.ownerId)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName || u.email}
                    </option>
                  ))}
              </select>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                />
              </div>
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
              {isSubmitting ? "Saving..." : initialData?.id ? "Save Changes" : "Create Plan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
