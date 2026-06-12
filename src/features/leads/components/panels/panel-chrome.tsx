"use client";

// Shared chrome for the Leads slide-in panels (lead detail + record panels):
// the keyframes (250ms ease-out-expo slide, 200ms backdrop fade — handoff
// §Interactions/Panels), the plum/28% backdrop, and the Esc-key hook.

import { useEffect } from "react";

export const PANEL_SLIDE_ANIMATION =
  "fm-lead-panel-slide 250ms cubic-bezier(0.16,1,0.3,1)";
export const PANEL_FADE_ANIMATION = "fm-lead-panel-fade 200ms ease-out";

export function PanelKeyframes() {
  return (
    <style>{`
      @keyframes fm-lead-panel-slide { from { transform: translateX(100%); } to { transform: translateX(0); } }
      @keyframes fm-lead-panel-fade { from { opacity: 0; } to { opacity: 1; } }
    `}</style>
  );
}

export function PanelBackdrop({
  onClick,
  zIndex,
}: {
  onClick: () => void;
  zIndex: number;
}) {
  return (
    <div
      aria-hidden
      onClick={onClick}
      className="absolute inset-0"
      style={{
        background: "rgba(64,55,112,0.28)",
        zIndex,
        animation: PANEL_FADE_ANIMATION,
      }}
    />
  );
}

/** Run `onEscape` on Esc keydown while `enabled`. Cleans up on unmount. */
export function useEscapeKey(onEscape: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEscape();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onEscape, enabled]);
}
