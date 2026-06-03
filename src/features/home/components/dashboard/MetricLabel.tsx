"use client";

import { useState, type ReactNode } from "react";

// An inline metric label with an (i) affordance that reveals a styled definition
// popover on hover or keyboard focus — a real tooltip, not the browser's native
// `title` (which is slow + unstyled). The popover resets case/tracking so it reads
// normally even inside an uppercase label. Plain-English copy only (no IDs/formulas).
export default function MetricLabel({ tip, children }: { tip: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
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
        className="leading-none text-[#C2BBD4] transition-colors hover:text-[#8A80A8] focus:outline-none focus-visible:text-[#8A80A8]"
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-50 mt-1.5 w-56 rounded-md bg-[#403770] px-2.5 py-2 text-[11px] font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
        >
          {tip}
        </span>
      )}
    </span>
  );
}
