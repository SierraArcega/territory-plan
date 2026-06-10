"use client";

// SegmentedControl — a labeled pill group for switching between a small set
// of mutually exclusive options (e.g. "My leads / Team", "Board / Table").
// Complements ViewToggle (icon-only); this one carries text labels and is
// generic over the option value type. Active segment: plum bg + white text.
// Container: white, border #D4CFE2, radius 8 (per tokens.md selected-state
// plum convention, consistent with ViewToggle).

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
      className={`inline-flex shrink-0 items-center gap-0.5 rounded-lg border border-[#D4CFE2] bg-white p-0.5 ${className ?? ""}`}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition-colors duration-[120ms] ${
              active
                ? "bg-[#403770] text-white"
                : "bg-transparent text-[#5C5277] hover:bg-[#F7F5FA]"
            }`}
          >
            {option.icon}
            <span className="whitespace-nowrap">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
