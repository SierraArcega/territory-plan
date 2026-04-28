"use client";

import { useActivitiesChrome, type FilterVariant } from "@/features/activities/lib/filters-store";
import { cn } from "@/features/shared/lib/cn";

const VARIANTS: { id: FilterVariant; label: string }[] = [
  { id: "rail", label: "Rail" },
  { id: "bar", label: "Bar" },
  { id: "chips", label: "Chips" },
];

interface FilterVariantSwitcherProps {
  /** Render inline (no fixed positioning). Useful for header embeds. */
  inline?: boolean;
  className?: string;
}

/**
 * Floating bottom-left switcher between filter UI variants. Persists via
 * `useActivitiesChrome.filterVariant` (already partialized to localStorage).
 *
 * Reference: design_handoff_activities_calendar/reference/components/FilterVariants.jsx:897-926
 */
export default function FilterVariantSwitcher({ inline, className }: FilterVariantSwitcherProps) {
  const variant = useActivitiesChrome((s) => s.filterVariant);
  const setVariant = useActivitiesChrome((s) => s.setFilterVariant);

  return (
    <div
      role="radiogroup"
      aria-label="Filter layout variant"
      className={cn(
        "inline-flex gap-0.5 p-[3px] rounded-full bg-white border border-[#D4CFE2] shadow-sm",
        !inline && "fixed bottom-4 left-4 z-40",
        className
      )}
    >
      {VARIANTS.map((v) => {
        const active = v.id === variant;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setVariant(v.id)}
            className={cn(
              "px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors duration-[120ms] ease-out",
              "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2",
              active
                ? "bg-[#403770] text-white"
                : "text-[#6E6390] hover:text-[#403770]"
            )}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
