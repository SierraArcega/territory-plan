"use client";

import { useState, useEffect, useCallback } from "react";
import { useUpdateCalendarSyncConfig } from "@/features/calendar/lib/queries";

interface SyncDirectionCardProps {
  value: "one_way" | "two_way";
}

export default function SyncDirectionCard({ value }: SyncDirectionCardProps) {
  const [direction, setDirection] = useState(value);
  const [showSaved, setShowSaved] = useState(false);
  const mutation = useUpdateCalendarSyncConfig();

  useEffect(() => {
    setDirection(value);
  }, [value]);

  const handleChange = useCallback(
    (newDirection: "one_way" | "two_way") => {
      if (newDirection === direction) return;
      setDirection(newDirection);
      mutation.mutate(
        { syncDirection: newDirection },
        {
          onSuccess: () => {
            setShowSaved(true);
            setTimeout(() => setShowSaved(false), 1500);
          },
        }
      );
    },
    [mutation, direction]
  );

  const options = [
    {
      value: "one_way" as const,
      label: "One-way (App \u2192 Calendar)",
      description: "Activities created in the app appear on your calendar",
    },
    {
      value: "two_way" as const,
      label: "Two-way sync",
      description: "Changes in either place stay in sync automatically",
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#D4CFE2] p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-[#403770]">Sync Direction</h3>
        {showSaved && (
          <span className="text-xs text-[#69B34A] font-medium animate-fade-in">
            Saved
          </span>
        )}
      </div>

      <fieldset>
        <legend className="sr-only">Sync Direction</legend>
        <div className="space-y-3">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-start gap-3 cursor-pointer group"
            >
              <div className="mt-0.5 flex-shrink-0 relative">
                <input
                  type="radio"
                  name="sync-direction"
                  value={option.value}
                  checked={direction === option.value}
                  onChange={() => handleChange(option.value)}
                  className="sr-only peer"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#F37167] peer-focus-visible:ring-offset-1 ${
                    direction === option.value
                      ? "border-[#403770]"
                      : "border-[#C2BBD4] group-hover:border-[#8A80A8]"
                  }`}
                >
                  {direction === option.value && (
                    <div className="w-2 h-2 rounded-full bg-[#403770]" />
                  )}
                </div>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#403770]">{option.label}</p>
                <p className="text-xs text-[#8A80A8] mt-0.5">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      {mutation.isError && (
        <p className="text-xs text-[#F37167] mt-3">
          Failed to save. <button onClick={() => handleChange(direction)} className="underline">Retry</button>
        </p>
      )}
    </div>
  );
}
