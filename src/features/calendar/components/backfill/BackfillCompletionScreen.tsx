// BackfillCompletionScreen — the "you're all caught up" finale for the
// backfill wizard. Shows a big celebration emoji, summary counts, and a
// CTA button that navigates the user to the Activities tab. Auto-forwards
// to Activities after 3 seconds via onGoToActivities.

"use client";

import { useEffect } from "react";

interface BackfillCompletionScreenProps {
  confirmed: number;
  dismissed: number;
  skipped: number;
  // Called when the user clicks the CTA or the auto-forward timer fires.
  // Typically closes the modal and routes to ?tab=activities.
  onGoToActivities: () => void;
  // Still accepted for back-compat — not used directly by this component but
  // the parent modal may want it for stray close paths.
  onClose?: () => void;
}

export default function BackfillCompletionScreen({
  confirmed,
  dismissed,
  skipped,
  onGoToActivities,
}: BackfillCompletionScreenProps) {
  // Auto-forward to Activities after 3s so the user doesn't have to click
  // anything on the happy path. Clicking the CTA forwards immediately.
  useEffect(() => {
    const timer = setTimeout(onGoToActivities, 3000);
    return () => clearTimeout(timer);
  }, [onGoToActivities]);

  const totalReviewed = confirmed + dismissed + skipped;

  return (
    <div
      className="flex flex-col items-center justify-center px-8 py-12 text-center"
      data-testid="backfill-completion-screen"
    >
      <div className="text-6xl mb-4" aria-hidden="true">
        🎉
      </div>
      <h2 className="text-2xl font-semibold text-[#403770]">You&apos;re all caught up</h2>
      <p className="mt-3 text-sm text-[#6E6390]">
        {confirmed} {confirmed === 1 ? "activity" : "activities"} logged from{" "}
        {totalReviewed} {totalReviewed === 1 ? "event" : "events"}
      </p>
      {(dismissed > 0 || skipped > 0) && (
        <p className="mt-1 text-xs text-[#8A80A8]">
          {dismissed} dismissed · {skipped} skipped for later
        </p>
      )}
      <button
        type="button"
        onClick={onGoToActivities}
        className="mt-8 inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors"
      >
        Go to Activities
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
