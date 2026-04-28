"use client";

// DealDisplayToggle — 3-button segmented control wired to useActivitiesChrome.
// Mirrors the ViewToggle pattern but uses plum-derived neutrals (no Tailwind grays).

import {
  useActivitiesChrome,
  type DealDisplay,
} from "@/features/activities/lib/filters-store";

interface Option {
  key: DealDisplay;
  label: string;
}

const OPTIONS: Option[] = [
  { key: "overlay", label: "Summary only" },
  { key: "objects", label: "As objects" },
  { key: "both", label: "Both" },
];

export default function DealDisplayToggle() {
  const dealDisplay = useActivitiesChrome((s) => s.dealDisplay);
  const setDealDisplay = useActivitiesChrome((s) => s.setDealDisplay);

  const baseStyles =
    "fm-focus-ring px-3 py-1.5 text-[12px] font-medium [transition-duration:120ms] transition-colors";
  const activeStyles = "bg-[#403770] text-white";
  const inactiveStyles =
    "bg-[#EFEDF5] text-[#6E6390] hover:bg-[#E2DEEC]";

  return (
    <div
      className="inline-flex rounded-md overflow-hidden"
      role="group"
      aria-label="Deal display"
    >
      {OPTIONS.map((opt, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === OPTIONS.length - 1;
        const rounding = isFirst && isLast
          ? "rounded-md"
          : isFirst
            ? "rounded-l-md"
            : isLast
              ? "rounded-r-md"
              : "";
        const active = dealDisplay === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => setDealDisplay(opt.key)}
            aria-pressed={active}
            aria-label={opt.label}
            className={`${baseStyles} ${rounding} ${active ? activeStyles : inactiveStyles}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
