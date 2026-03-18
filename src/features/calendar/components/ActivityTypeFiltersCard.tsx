"use client";

import { useState, useEffect, useCallback } from "react";
import { useUpdateCalendarSyncConfig } from "@/features/calendar/lib/queries";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  CATEGORY_LABELS,
  ALL_ACTIVITY_TYPES,
  type ActivityType,
  type ActivityCategory,
} from "@/features/activities/types";

interface ActivityTypeFiltersCardProps {
  value: string[];
}

export default function ActivityTypeFiltersCard({ value }: ActivityTypeFiltersCardProps) {
  // Empty array = all types synced. Convert to full set for display.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(value.length === 0 ? ALL_ACTIVITY_TYPES : value)
  );
  const [showSaved, setShowSaved] = useState(false);
  const mutation = useUpdateCalendarSyncConfig();

  useEffect(() => {
    setSelected(new Set(value.length === 0 ? ALL_ACTIVITY_TYPES : value));
  }, [value]);

  const save = useCallback(
    (newSelected: Set<string>) => {
      // If all are selected, send empty array (opt-out model)
      const payload =
        newSelected.size === ALL_ACTIVITY_TYPES.length
          ? []
          : Array.from(newSelected);

      mutation.mutate(
        { syncedActivityTypes: payload },
        {
          onSuccess: () => {
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 1500);
          },
        }
      );
    },
    [mutation]
  );

  const toggleType = useCallback(
    (type: string) => {
      const next = new Set(selected);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      setSelected(next);
      save(next);
    },
    [selected, save]
  );

  const toggleCategory = useCallback(
    (category: ActivityCategory) => {
      const types = ACTIVITY_CATEGORIES[category] as readonly string[];
      const allSelected = types.every((t) => selected.has(t));
      const next = new Set(selected);

      if (allSelected) {
        types.forEach((t) => next.delete(t));
      } else {
        types.forEach((t) => next.add(t));
      }

      setSelected(next);
      save(next);
    },
    [selected, save]
  );

  const categories = Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[];

  return (
    <div className="bg-white rounded-xl border border-[#D4CFE2] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#403770]">Activity Types to Sync</h3>
        {showSaved && (
          <span className="text-xs text-[#69B34A] font-medium animate-fade-in">
            Saved
          </span>
        )}
      </div>

      <div className="space-y-4">
        {categories.map((category) => {
          const types = ACTIVITY_CATEGORIES[category] as readonly ActivityType[];
          const allSelected = types.every((t) => selected.has(t));
          const someSelected = types.some((t) => selected.has(t)) && !allSelected;

          return (
            <div key={category}>
              {/* Category header with select-all */}
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected;
                    }}
                    onChange={() => toggleCategory(category)}
                    className="sr-only peer"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    allSelected
                      ? "bg-[#403770] border-[#403770]"
                      : someSelected
                        ? "bg-[#403770]/50 border-[#403770]/50"
                        : "border-[#C2BBD4] hover:border-[#8A80A8]"
                  }`}>
                    {(allSelected || someSelected) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        {allSelected ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        ) : (
                          <path strokeLinecap="round" strokeWidth={3} d="M6 12h12" />
                        )}
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs font-semibold text-[#6E6390] uppercase tracking-wide">
                  {CATEGORY_LABELS[category]}
                </span>
              </label>

              {/* Individual type checkboxes */}
              <div className="ml-6 space-y-1.5">
                {types.map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={selected.has(type)}
                        onChange={() => toggleType(type)}
                        className="sr-only"
                      />
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                        selected.has(type)
                          ? "bg-[#403770] border-[#403770]"
                          : "border-[#C2BBD4] group-hover:border-[#8A80A8]"
                      }`}>
                        {selected.has(type) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-[#6E6390]">
                      {ACTIVITY_TYPE_ICONS[type]} {ACTIVITY_TYPE_LABELS[type]}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {mutation.isError && (
        <p className="text-xs text-[#F37167] mt-3">
          Failed to save. <button onClick={() => save(selected)} className="underline">Retry</button>
        </p>
      )}
    </div>
  );
}
