// BackfillCompletionScreen — the "you're all caught up" finale for the
// backfill wizard. Shows a big celebration emoji, summary counts, and a
// CTA button. Auto-closes after 3 seconds via onClose.

"use client";

import { useEffect } from "react";

interface BackfillCompletionScreenProps {
  confirmed: number;
  dismissed: number;
  skipped: number;
  onClose: () => void;
}

export default function BackfillCompletionScreen({
  confirmed,
  dismissed,
  skipped,
  onClose,
}: BackfillCompletionScreenProps) {
  // Auto-close after 3s so the user doesn't have to click anything on the
  // happy path. Clicking the CTA closes immediately.
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

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
        onClick={onClose}
        className="mt-8 inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors"
      >
        Go to Activities
        <span aria-hidden="true">→</span>
      </button>
    </div>
  );
}
