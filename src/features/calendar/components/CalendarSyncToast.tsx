// CalendarSyncToast — Bottom-right non-blocking toast that surfaces new
// calendar events after an incremental auto-sync. The parent (HomeView)
// controls visibility; the toast handles its own auto-dismiss timer and
// animates in from the bottom.

"use client";

import { useEffect } from "react";

interface CalendarSyncToastProps {
  visible: boolean;
  newEventCount: number;
  onDismiss: () => void;
  onReview: () => void;
}

const AUTO_DISMISS_MS = 6000;

export default function CalendarSyncToast({
  visible,
  newEventCount,
  onDismiss,
  onReview,
}: CalendarSyncToastProps) {
  // Auto-dismiss after 6 seconds. Restart the timer whenever visibility or
  // count changes so re-triggering the toast resets the countdown.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [visible, newEventCount, onDismiss]);

  if (!visible) return null;

  const headline =
    newEventCount === 1 ? "1 new event from your calendar" : `${newEventCount} new events from your calendar`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-40 bg-white rounded-xl border border-[#D4CFE2] shadow-xl p-4 max-w-sm flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-300"
      data-testid="calendar-sync-toast"
    >
      <div className="w-9 h-9 rounded-full bg-[#403770]/10 flex items-center justify-center flex-shrink-0 text-lg" aria-hidden="true">
        📅
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#403770]">{headline}</p>
        <p className="mt-0.5 text-xs text-[#8A80A8]">
          Log them now or review later.
        </p>
        <button
          type="button"
          onClick={onReview}
          className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#F37167] hover:text-[#e0564c] transition-colors"
        >
          Review in inbox
          <span aria-hidden="true">→</span>
        </button>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-[#8A80A8] hover:text-[#403770] transition-colors flex-shrink-0"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
