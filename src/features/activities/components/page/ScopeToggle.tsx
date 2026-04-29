"use client";

import { cn } from "@/features/shared/lib/cn";

export type ActivityScope = "mine" | "all";

interface ScopeToggleProps {
  scope: ActivityScope;
  onChange: (scope: ActivityScope) => void;
  className?: string;
}

const OPTIONS: { id: ActivityScope; label: string; activeDot: string }[] = [
  { id: "mine", label: "My activities", activeDot: "bg-[#F37167]" },
  { id: "all", label: "All of Fullmind", activeDot: "bg-[#FFCF70]" },
];

/**
 * "My activities | All of Fullmind" pill. Drives owner default + scope-aware copy.
 * Reference: design_handoff_activities_calendar/reference/components/CalendarChrome.jsx:38-72
 */
export default function ScopeToggle({ scope, onChange, className }: ScopeToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Activity scope"
      className={cn(
        "inline-flex p-[3px] rounded-[10px] bg-[#FFFCFA] border border-[#D4CFE2]",
        className
      )}
    >
      {OPTIONS.map((o) => {
        const active = scope === o.id;
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "fm-focus-ring px-3 py-1.5 text-xs rounded-md transition-all duration-[120ms] ease-out whitespace-nowrap",
              "inline-flex items-center gap-1.5",
              active
                ? "bg-[#403770] text-white font-semibold"
                : "text-[#544A78] font-medium hover:text-[#403770]"
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                active ? o.activeDot : "bg-[#A69DC0]"
              )}
            />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
