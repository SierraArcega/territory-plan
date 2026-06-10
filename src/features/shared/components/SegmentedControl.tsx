"use client";

// SegmentedControl — a labeled pill group for switching between a small set
// of mutually exclusive options (e.g. "My leads / Team", "Board / Table").
// Complements ViewToggle (icon-only); this one carries text labels and is
// generic over the option value type. Visuals follow the leads design
// prototype's recessed style: #EFEDF5 track (radius 9, 3px padding), active
// segment = white card with plum text + subtle shadow, inactive = muted
// text on the track; active icons tint coral.

import type { ReactNode } from "react";

export interface SegmentedOption<V extends string> {
  value: V;
  label: string;
  /** Optional leading icon (Lucide, sized by the caller). */
  icon?: ReactNode;
}

interface SegmentedControlProps<V extends string> {
  options: SegmentedOption<V>[];
  value: V;
  onChange: (value: V) => void;
  /** Accessible name for the group. */
  ariaLabel: string;
  className?: string;
}

export default function SegmentedControl<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedControlProps<V>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`inline-flex shrink-0 items-center gap-[2px] rounded-[9px] bg-[#EFEDF5] p-[3px] ${className ?? ""}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-[7px] px-[11px] py-[5px] text-[12.5px] font-semibold transition-all duration-[120ms] ${
              active
                ? "bg-white text-[#403770] shadow-[0_1px_2px_rgba(64,55,112,0.12)]"
                : "bg-transparent text-[#8A80A8] hover:text-[#5C5277]"
            }`}
          >
            {option.icon && (
              <span
                className={`inline-flex ${active ? "text-[#F37167]" : "text-current"}`}
                aria-hidden
              >
                {option.icon}
              </span>
            )}
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
