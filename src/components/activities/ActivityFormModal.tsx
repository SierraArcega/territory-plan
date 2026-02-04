"use client";

import { useState, useEffect, useRef } from "react";
import { useCreateActivity, useTerritoryPlans, useStates } from "@/lib/api";
import {
  type ActivityCategory,
  type ActivityType,
  type ActivityStatus,
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  CATEGORY_LABELS,
  VALID_ACTIVITY_STATUSES,
  DEFAULT_TYPE_FOR_CATEGORY,
} from "@/lib/activityTypes";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultCategory?: ActivityCategory;
  defaultPlanId?: string;
}

export default function ActivityFormModal({
  isOpen,
  onClose,
  defaultCategory,
  defaultPlanId,
}: ActivityFormModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const createActivity = useCreateActivity();
  const { data: plans } = useTerritoryPlans();
  const { data: states } = useStates();

  // Form state
  const [type, setType] = useState<ActivityType>(
    defaultCategory ? DEFAULT_TYPE_FOR_CATEGORY[defaultCategory] : "conference"
  );
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState("");
  const [isMultiDay, setIsMultiDay] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ActivityStatus>("planned");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>(
    defaultPlanId ? [defaultPlanId] : []
  );
  const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setType(
        defaultCategory ? DEFAULT_TYPE_FOR_CATEGORY[defaultCategory] : "conference"
      );
      setTitle("");
      setStartDate(new Date().toISOString().split("T")[0]);
      setEndDate("");
      setIsMultiDay(false);
      setNotes("");
      setStatus("planned");
      setSelectedPlanIds(defaultPlanId ? [defaultPlanId] : []);
      setSelectedStateFips([]);
    }
  }, [isOpen, defaultCategory, defaultPlanId]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startDate) return;

    try {
      await createActivity.mutateAsync({
        type,
        title: title.trim(),
        startDate,
        endDate: isMultiDay && endDate ? endDate : undefined,
        notes: notes.trim() || undefined,
        status,
        planIds: selectedPlanIds.length > 0 ? selectedPlanIds : undefined,
        stateFips: selectedStateFips.length > 0 ? selectedStateFips : undefined,
      });
      onClose();
    } catch (error) {
      console.error("Failed to create activity:", error);
    }
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((id) => id !== planId)
        : [...prev, planId]
    );
  };

  const toggleState = (fips: string) => {
    setSelectedStateFips((prev) =>
      prev.includes(fips)
        ? prev.filter((f) => f !== fips)
        : [...prev, fips]
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-[#403770]">New Activity</h2>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="px-6 py-4 space-y-5">
            {/* Type selector - grouped by category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Activity Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ActivityType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
              >
                {(Object.entries(ACTIVITY_CATEGORIES) as [ActivityCategory, readonly ActivityType[]][]).map(
                  ([category, types]) => (
                    <optgroup key={category} label={CATEGORY_LABELS[category]}>
                      {types.map((t) => (
                        <option key={t} value={t}>
                          {ACTIVITY_TYPE_ICONS[t]} {ACTIVITY_TYPE_LABELS[t]}
                        </option>
                      ))}
                    </optgroup>
                  )
                )}
              </select>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., SC Education Conference"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                required
              />
            </div>

            {/* Dates */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date <span className="text-red-500">*</span>
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                  required
                />
                {isMultiDay && (
                  <>
                    <span className="text-gray-400">→</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      min={startDate}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent"
                    />
                  </>
                )}
              </div>
              <label className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={isMultiDay}
                  onChange={(e) => {
                    setIsMultiDay(e.target.checked);
                    if (!e.target.checked) setEndDate("");
                  }}
                  className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
                />
                Multi-day event
              </label>
            </div>

            {/* Plans selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Link to Plans
              </label>
              <div className="border border-gray-300 rounded-lg max-h-32 overflow-y-auto">
                {plans && plans.length > 0 ? (
                  plans.map((plan) => (
                    <label
                      key={plan.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlanIds.includes(plan.id)}
                        onChange={() => togglePlan(plan.id)}
                        className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
                      />
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: plan.color }}
                      />
                      <span className="text-sm text-gray-700 truncate">
                        {plan.name}
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    No plans yet
                  </p>
                )}
              </div>
              {selectedPlanIds.length === 0 && (
                <p className="mt-1 text-xs text-amber-600">
                  Activities without plans will be flagged for follow-up
                </p>
              )}
            </div>

            {/* States selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                States
              </label>
              <div className="border border-gray-300 rounded-lg max-h-32 overflow-y-auto">
                {states && states.length > 0 ? (
                  states.map((state) => (
                    <label
                      key={state.fips}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStateFips.includes(state.fips)}
                        onChange={() => toggleState(state.fips)}
                        className="rounded border-gray-300 text-[#403770] focus:ring-[#403770]"
                      />
                      <span className="text-sm text-gray-700">
                        {state.name} ({state.abbrev})
                      </span>
                    </label>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-500">
                    Loading states...
                  </p>
                )}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes or details..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent resize-none"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex gap-4">
                {VALID_ACTIVITY_STATUSES.map((s) => (
                  <label
                    key={s}
                    className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="status"
                      value={s}
                      checked={status === s}
                      onChange={(e) => setStatus(e.target.value as ActivityStatus)}
                      className="text-[#403770] focus:ring-[#403770]"
                    />
                    <span className="capitalize">{s}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !startDate || createActivity.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {createActivity.isPending ? "Creating..." : "Create Activity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
