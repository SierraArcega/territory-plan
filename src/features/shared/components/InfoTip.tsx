"use client";

// InfoTip — a small info dot that reveals a plum tooltip card on hover/focus.
// Used to define pipeline stages on board column headers and anywhere a short
// inline definition is needed. `align` controls which edge the 240px card
// anchors to so it stays inside scroll containers (first column "left", last
// column "right", else "center"). Click toggles for touch devices; Escape
// dismisses. Visuals per the leads design handoff: plum #403770 card, white
// text, radius 12, tooltip shadow, 150ms tipFade ease-out-expo.

import { useId, useState, type ReactNode } from "react";
import { Info } from "lucide-react";

export type InfoTipAlign = "left" | "center" | "right";

interface InfoTipProps {
  /** Tooltip body text. */
  text: ReactNode;
  /** Optional bold heading line inside the card. */
  label?: string;
  /** Which edge the card anchors to (default "center"). */
  align?: InfoTipAlign;
  /** Icon size in px (default 13). */
  size?: number;
  /** Resting icon color (default muted lavender #B8B0D0). */
  color?: string;
}

const ALIGN_POS: Record<InfoTipAlign, React.CSSProperties> = {
  left: { left: 0 },
  right: { right: 0 },
  center: { left: "50%", transform: "translateX(-50%)" },
};

export default function InfoTip({
  text,
  label,
  align = "center",
  size = 13,
  color = "#B8B0D0",
}: InfoTipProps) {
  const [show, setShow] = useState(false);
  const tipId = useId();

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        aria-label={label ?? "More information"}
        aria-describedby={show ? tipId : undefined}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        onClick={() => setShow((s) => !s)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && show) {
            e.stopPropagation();
            setShow(false);
          }
        }}
        className="flex cursor-help items-center border-0 bg-transparent p-0 outline-none transition-colors duration-[120ms]"
        style={{ color: show ? "#7A6FD0" : color }}
      >
        <Info size={size} aria-hidden />
      </button>
      {show && (
        <span
          role="tooltip"
          id={tipId}
          className="pointer-events-none absolute top-[calc(100%+7px)] z-[60] block w-[240px] whitespace-normal rounded-xl bg-[#403770] px-3 py-2.5 text-left text-[11.5px] font-medium normal-case leading-[1.5] tracking-normal text-[#EDE9F7] shadow-[0_10px_28px_-8px_rgba(64,55,112,0.5)]"
          style={{
            ...ALIGN_POS[align],
            animation: "fm-tip-fade 150ms cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <style>{`@keyframes fm-tip-fade { from { opacity: 0; transform: ${align === "center" ? "translateX(-50%) " : ""}translateY(3px); } to { opacity: 1; transform: ${align === "center" ? "translateX(-50%) " : ""}translateY(0); } }`}</style>
          {label && (
            <span className="mb-1 block text-[11px] font-bold tracking-[0.01em] text-white">
              {label}
            </span>
          )}
          {text}
        </span>
      )}
    </span>
  );
}
