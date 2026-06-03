"use client";

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

// An inline metric label with an (i) affordance that reveals a styled definition
// popover on hover or keyboard focus — a real tooltip, not the browser's native
// `title` (slow + unstyled). Follows the Display/tooltips "Simple Dark" spec: plum
// fill, white text, z-30, pointer-events-none, aria-describedby. `whitespace-normal`
// is required — the popover sits inside an uppercase `whitespace-nowrap` label and
// would otherwise inherit nowrap and overflow on one line. Plain-English copy only.
export default function MetricLabel({ tip, children }: { tip: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const tipId = useId();
  return (
    <span
      className="relative inline-flex items-center gap-1"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span>{children}</span>
      <button
        type="button"
        aria-label="What this means"
        aria-describedby={open ? tipId : undefined}
        className="inline-flex leading-none text-[#C2BBD4] transition-colors hover:text-[#8A80A8] focus:outline-none focus-visible:text-[#8A80A8]"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none tooltip-enter absolute left-1/2 top-full z-30 mt-1.5 w-60 -translate-x-1/2 whitespace-normal rounded-lg bg-[#403770] px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {tip}
        </span>
      )}
    </span>
  );
}
