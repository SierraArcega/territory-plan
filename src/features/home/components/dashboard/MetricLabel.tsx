"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

// Definition popover width (px) — fixed so we can clamp it within the viewport.
const WIDTH = 240;

// An inline metric label with an (i) affordance that reveals a styled definition
// popover on hover or keyboard focus (a real tooltip, not the native `title`).
// Rendered in a portal to document.body so it escapes the dashboard's overflow/
// scroll containers (which were clipping an in-card absolute popover), and clamped
// to the viewport so edge cards don't run off-screen. Follows Display/tooltips
// "Simple Dark": plum fill, white text, z-30, pointer-events-none, aria-describedby.
export default function MetricLabel({ tip, children }: { tip: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  const show = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      const center = r.left + r.width / 2;
      const left = Math.max(8, Math.min(center - WIDTH / 2, window.innerWidth - WIDTH - 8));
      setPos({ top: r.bottom + 6, left });
    }
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={ref}
      className="relative inline-flex items-center gap-1"
      onMouseEnter={show}
      onMouseLeave={hide}
    >
      <span>{children}</span>
      <button
        type="button"
        aria-label="What this means"
        aria-describedby={open ? tipId : undefined}
        className="inline-flex leading-none text-[#C2BBD4] transition-colors hover:text-[#8A80A8] focus:outline-none focus-visible:text-[#8A80A8]"
        onFocus={show}
        onBlur={hide}
      >
        <Info size={13} aria-hidden="true" />
      </button>
      {open && pos && typeof document !== "undefined" &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: WIDTH }}
            className="pointer-events-none tooltip-enter z-30 rounded-lg bg-[#403770] px-3 py-2 text-xs font-normal normal-case leading-snug tracking-normal text-white shadow-lg"
          >
            {tip}
          </span>,
          document.body,
        )}
    </span>
  );
}
