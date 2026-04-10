// BackfillWindowPicker — Step 1 of the backfill setup wizard.
// Four preset cards (7 / 30 / 60 / 90 days) in a 2x2 grid. 30 is pre-selected
// with a star badge. "Maybe later" cancels, "Start sync →" kicks off the
// backfill mutation in the parent.

"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import type { BackfillDays } from "@/features/calendar/lib/queries";

interface BackfillWindowPickerProps {
  onStart: (days: BackfillDays) => void;
  onCancel: () => void;
  isLoading: boolean;
}

interface PresetCard {
  days: BackfillDays;
  label: string;
  split: string;
  range: string;
  subtitle: string;
  isDefault: boolean;
}

// Each preset is SYMMETRIC around today: the wizard pulls the same number of
// days before and after "now", so picking 30 means "past 30 days + next 30 days".
// Event-count ranges are doubled from the historic past-only estimates.
const PRESETS: PresetCard[] = [
  { days: 7,  label: "± 7 days",  split: "7 days back + 7 days forward",   range: "~10-30 events",   subtitle: "This week and next",    isDefault: false },
  { days: 30, label: "± 30 days", split: "30 days back + 30 days forward", range: "~40-80 events",   subtitle: "Monthly view",          isDefault: true  },
  { days: 60, label: "± 60 days", split: "60 days back + 60 days forward", range: "~80-160 events",  subtitle: "Two-month horizon",     isDefault: false },
  { days: 90, label: "± 90 days", split: "90 days back + 90 days forward", range: "~120-240 events", subtitle: "Full fiscal quarter",   isDefault: false },
];

export default function BackfillWindowPicker({
  onStart,
  onCancel,
  isLoading,
}: BackfillWindowPickerProps) {
  const [selected, setSelected] = useState<BackfillDays | null>(30);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Focus the default card on mount
  useEffect(() => {
    const defaultIndex = PRESETS.findIndex((p) => p.isDefault);
    if (defaultIndex >= 0) {
      buttonRefs.current[defaultIndex]?.focus();
    }
  }, []);

  const handleCardKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    // 2x2 grid movement
    let nextIndex = index;
    if (e.key === "ArrowRight") nextIndex = index + 1;
    else if (e.key === "ArrowLeft") nextIndex = index - 1;
    else if (e.key === "ArrowDown") nextIndex = index + 2;
    else if (e.key === "ArrowUp") nextIndex = index - 2;
    else return;

    if (nextIndex >= 0 && nextIndex < PRESETS.length) {
      e.preventDefault();
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className="p-8">
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-[#403770]">
          Sync your calendar
        </h2>
        <p className="mt-2 text-sm text-[#6E6390]">
          Pick how much of your calendar to bring in. We&apos;ll pull the same
          number of days{" "}
          <span className="font-semibold text-[#403770]">before and after today</span>{" "}
          so you can log past meetings and plan for upcoming ones in one pass.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Backfill window preset"
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8"
      >
        {PRESETS.map((preset, index) => {
          const isSelected = selected === preset.days;
          return (
            <button
              key={preset.days}
              ref={(el) => {
                buttonRefs.current[index] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${preset.label} — ${preset.split}`}
              onClick={() => setSelected(preset.days)}
              onKeyDown={(e) => handleCardKeyDown(e, index)}
              className={`
                relative text-left p-5 rounded-lg transition-colors
                focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-2
                ${
                  isSelected
                    ? "bg-[#F7F5FA] border-2 border-[#403770] ring-2 ring-[#403770]/10"
                    : "bg-white border border-[#D4CFE2] hover:border-[#403770]"
                }
              `}
            >
              {preset.isDefault && (
                <span
                  className="absolute top-2 right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-[#F37167] text-white text-[10px] font-semibold"
                  aria-label="Recommended"
                >
                  <span aria-hidden="true">★</span>
                  <span>Recommended</span>
                </span>
              )}
              <div className="text-base font-semibold text-[#403770]">
                {preset.label}
              </div>
              <div className="mt-1 text-xs font-medium text-[#544A78]">
                {preset.split}
              </div>
              <div className="mt-2 text-xs text-[#8A80A8]">{preset.range}</div>
              <div className="mt-1 text-xs text-[#6E6390]">{preset.subtitle}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770] transition-colors disabled:opacity-50"
        >
          Maybe later
        </button>
        <button
          type="button"
          onClick={() => selected && onStart(selected)}
          disabled={!selected || isLoading}
          className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="2"
                  opacity="0.25"
                />
                <path
                  d="M4 12a8 8 0 018-8"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              Starting sync...
            </>
          ) : (
            <>
              Start sync
              <span aria-hidden="true">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
