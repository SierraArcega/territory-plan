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
  const [stateSearch, setStateSearch] = useState("");
  const [stateActiveIndex, setStateActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const stateSearchRef = useRef<HTMLInputElement>(null);
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
                        className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#403770]/10 text-[#403770] rounded-full text-xs font-medium"
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
                  aria-haspopup="listbox"
                  aria-expanded={showStateDropdown}
                  onClick={() => {
                    const next = !showStateDropdown;
                    setShowStateDropdown(next);
                    if (next) {
                      setStateSearch("");
                      setStateActiveIndex(-1);
                      requestAnimationFrame(() => stateSearchRef.current?.focus());
                    }
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent text-left"
                >
                  <span className={formData.stateFips.length === 0 ? "text-gray-400" : "text-gray-700"}>
                    {formData.stateFips.length === 0
                      ? "Select states..."
                      : formData.stateFips.length <= 3
                        ? formData.stateFips
                            .map((fips) => allStates?.find((s) => s.fips === fips)?.abbrev || fips)
                            .sort()
                            .join(", ")
                        : `${formData.stateFips.length} states`}
                  </span>
                  <svg
                    width="10" height="10" viewBox="0 0 10 10" fill="none"
                    className={`text-gray-400 shrink-0 ml-1 transition-transform duration-150 ${showStateDropdown ? "rotate-180" : ""}`}
                  >
                    <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {showStateDropdown && (() => {
                  const q = stateSearch.toLowerCase();
                  const filtered = q
                    ? (allStates ?? []).filter(
                        (s) => s.name.toLowerCase().includes(q) || s.abbrev.toLowerCase().includes(q)
                      )
                    : (allStates ?? []);

                  const filteredFips = filtered.map((s) => s.fips);
                  const filteredSelected = filteredFips.filter((fips) => formData.stateFips.includes(fips));
                  const anyFilteredSelected = filteredSelected.length > 0;
                  const selectAllState: "true" | "false" | "mixed" =
                    filteredSelected.length === 0
                      ? "false"
                      : filteredSelected.length === filteredFips.length
                      ? "true"
                      : "mixed";
                  const selectAllLabel = anyFilteredSelected
                    ? "Deselect all"
                    : q
                    ? `Select ${filteredFips.length} results`
                    : `Select all ${allStates?.length ?? 0}`;

                  const applySelectAll = () => {
                    if (anyFilteredSelected) {
                      const filteredSet = new Set(filteredFips);
                      setFormData({ ...formData, stateFips: formData.stateFips.filter((f) => !filteredSet.has(f)) });
                    } else {
                      const existing = new Set(formData.stateFips);
                      setFormData({ ...formData, stateFips: [...formData.stateFips, ...filteredFips.filter((f) => !existing.has(f))] });
                    }
                  };

                  const toggleFips = (fips: string) => {
                    const newFips = formData.stateFips.includes(fips)
                      ? formData.stateFips.filter((f) => f !== fips)
                      : [...formData.stateFips, fips];
                    setFormData({ ...formData, stateFips: newFips });
                  };

                  return (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {/* Search input */}
                      <div className="px-2 pt-2 pb-1 border-b border-gray-100">
                        <input
                          ref={stateSearchRef}
                          type="text"
                          value={stateSearch}
                          onChange={(e) => {
                            setStateSearch(e.target.value);
                            setStateActiveIndex(-1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "ArrowDown") {
                              e.preventDefault();
                              if (filtered.length === 0) return;
                              setStateActiveIndex((h) => Math.min(h + 1, filtered.length));
                            } else if (e.key === "ArrowUp") {
                              e.preventDefault();
                              if (filtered.length === 0) return;
                              setStateActiveIndex((h) => (h <= 0 ? 0 : h - 1));
                            } else if (e.key === "Enter") {
                              e.preventDefault();
                              if (stateActiveIndex === 0) {
                                applySelectAll();
                              } else if (stateActiveIndex > 0 && filtered[stateActiveIndex - 1]) {
                                toggleFips(filtered[stateActiveIndex - 1].fips);
                              }
                            } else if (e.key === "Escape") {
                              e.preventDefault();
                              if (stateSearch) {
                                setStateSearch("");
                                setStateActiveIndex(-1);
                              } else {
                                setShowStateDropdown(false);
                              }
                            }
                          }}
                          placeholder="Search states..."
                          className="w-full text-sm bg-gray-50 border border-gray-200 rounded-md px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]/30 placeholder:text-gray-400"
                        />
                      </div>

                      {/* Options list */}
                      <div role="listbox" aria-multiselectable="true" aria-label="States" className="max-h-48 overflow-y-auto">
                        {/* Select All row */}
                        {filtered.length > 0 && (
                          <div
                            role="checkbox"
                            aria-checked={selectAllState}
                            aria-label={selectAllLabel}
                            tabIndex={-1}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              setStateActiveIndex(0);
                              applySelectAll();
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-gray-700 border-b border-gray-100 cursor-pointer select-none transition-colors ${
                              stateActiveIndex === 0 ? "bg-[#403770]/10" : "bg-gray-50/50 hover:bg-gray-50"
                            }`}
                          >
                            <div
                              aria-hidden="true"
                              className={
                                selectAllState === "false"
                                  ? "w-4 h-4 rounded border border-gray-300 bg-white flex-shrink-0"
                                  : "w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                              }
                            >
                              {selectAllState === "mixed" && (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white" />
                                </svg>
                              )}
                              {selectAllState === "true" && (
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                  <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </div>
                            <span>{selectAllLabel}</span>
                          </div>
                        )}

                        {/* No results */}
                        {filtered.length === 0 && (
                          <div className="px-2.5 py-2 text-xs text-gray-400 italic">
                            No states match &ldquo;{stateSearch}&rdquo;
                          </div>
                        )}

                        {/* State rows */}
                        {filtered.map((s, i) => (
                          <label
                            key={s.fips}
                            role="option"
                            aria-selected={formData.stateFips.includes(s.fips)}
                            ref={(el) => {
                              if (i === stateActiveIndex - 1 && el) {
                                el.scrollIntoView({ block: "nearest" });
                              }
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setStateActiveIndex(i + 1);
                              toggleFips(s.fips);
                            }}
                            className={`flex items-center gap-2 px-2.5 py-1 cursor-pointer transition-colors ${
                              stateActiveIndex === i + 1 ? "bg-[#403770]/10" : "hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={formData.stateFips.includes(s.fips)}
                              onChange={() => {}}
                              tabIndex={-1}
                              aria-hidden="true"
                              className="w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30"
                            />
                            <span className="text-sm text-gray-700">{s.name}</span>
                            <span className="text-xs text-gray-400 ml-auto">{s.abbrev}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
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
