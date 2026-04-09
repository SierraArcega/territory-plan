// BackfillSetupModal — The full-screen modal that orchestrates the backfill
// wizard. Owns step state (picker → loading → wizard → complete/empty/error)
// and delegates to the sub-components. Mirrors the ActivityFormModal portal
// pattern (fixed overlay, rounded-2xl body on md+, rounded-none full-screen
// on mobile).

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useCalendarInbox,
  useCompleteBackfill,
  useStartBackfill,
  type BackfillDays,
} from "@/features/calendar/lib/queries";
import BackfillWindowPicker from "./BackfillWindowPicker";
import BackfillWizard from "./BackfillWizard";
import BackfillCompletionScreen from "./BackfillCompletionScreen";

type Step = "picker" | "loading" | "wizard" | "empty" | "complete" | "error";

interface BackfillSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialStep?: "picker" | "wizard";
}

interface WizardCounts {
  confirmed: number;
  dismissed: number;
  skipped: number;
}

export default function BackfillSetupModal({
  isOpen,
  onClose,
  initialStep = "picker",
}: BackfillSetupModalProps) {
  const [step, setStep] = useState<Step>(initialStep === "wizard" ? "wizard" : "picker");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState<WizardCounts>({
    confirmed: 0,
    dismissed: 0,
    skipped: 0,
  });

  const modalRef = useRef<HTMLDivElement>(null);

  const startMutation = useStartBackfill();
  const completeMutation = useCompleteBackfill();

  // Only fetch the inbox when we're actively in the wizard step — avoids a
  // wasted fetch during the picker step.
  const { data: inboxData, isLoading: inboxLoading } = useCalendarInbox(
    step === "wizard" ? "pending" : undefined
  );

  // Reset step and errors whenever the modal re-opens
  useEffect(() => {
    if (isOpen) {
      setStep(initialStep === "wizard" ? "wizard" : "picker");
      setErrorMessage(null);
      setCounts({ confirmed: 0, dismissed: 0, skipped: 0 });
    }
  }, [isOpen, initialStep]);

  // Body scroll lock while the modal is visible
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);

  // Escape key closes
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleStart = useCallback(
    (days: BackfillDays) => {
      setStep("loading");
      setErrorMessage(null);
      startMutation.mutate(days, {
        onSuccess: (result) => {
          if (!result || result.pendingCount === 0) {
            setStep("empty");
          } else {
            setStep("wizard");
          }
        },
        onError: (err) => {
          setErrorMessage(err instanceof Error ? err.message : "Couldn't reach Google.");
          setStep("error");
        },
      });
    },
    [startMutation]
  );

  const handleWizardComplete = useCallback(
    (finalCounts: WizardCounts) => {
      setCounts(finalCounts);
      completeMutation.mutate(undefined, {
        onSuccess: () => setStep("complete"),
        onError: () => {
          // Even if the API call fails, still show the completion screen so
          // the user doesn't get stuck. The connection will eventually re-sync.
          setStep("complete");
        },
      });
    },
    [completeMutation]
  );

  const handleRetry = useCallback(() => {
    setStep("picker");
    setErrorMessage(null);
  }, []);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  if (!isOpen) return null;

  const inboxEvents = inboxData?.events ?? [];
  const isStarting = startMutation.isPending || step === "loading";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#403770]/40 backdrop-blur-sm p-0 md:p-4"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="backfill-modal-title"
      data-testid="backfill-setup-modal"
    >
      <div
        ref={modalRef}
        className="relative bg-white shadow-xl max-w-2xl w-full max-h-full md:max-h-[90vh] md:rounded-2xl rounded-none overflow-hidden flex flex-col"
      >
        {/* Close button — always available */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 z-20 w-8 h-8 flex items-center justify-center rounded-lg text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 id="backfill-modal-title" className="sr-only">
          Google Calendar backfill
        </h2>

        {step === "picker" && (
          <BackfillWindowPicker
            onStart={handleStart}
            onCancel={onClose}
            isLoading={isStarting}
          />
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <svg
              className="w-10 h-10 animate-spin text-[#F37167]"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                opacity="0.25"
              />
              <path
                d="M4 12a8 8 0 018-8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
              />
            </svg>
            <p className="mt-5 text-base font-medium text-[#403770]">
              Pulling your calendar from Google...
            </p>
            <p className="mt-1 text-sm text-[#8A80A8]">This usually takes a few seconds.</p>
          </div>
        )}

        {step === "wizard" && (
          <>
            {inboxLoading && inboxEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
                <svg
                  className="w-8 h-8 animate-spin text-[#F37167]"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    opacity="0.25"
                  />
                  <path
                    d="M4 12a8 8 0 018-8"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <p className="mt-4 text-sm text-[#6E6390]">Loading events...</p>
              </div>
            ) : inboxEvents.length === 0 ? (
              <EmptyState onClose={onClose} />
            ) : (
              <BackfillWizard
                events={inboxEvents}
                onComplete={handleWizardComplete}
                onClose={onClose}
              />
            )}
          </>
        )}

        {step === "empty" && <EmptyState onClose={onClose} />}

        {step === "complete" && (
          <BackfillCompletionScreen
            confirmed={counts.confirmed}
            dismissed={counts.dismissed}
            skipped={counts.skipped}
            onClose={onClose}
          />
        )}

        {step === "error" && (
          <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F37167]/10 flex items-center justify-center mb-4">
              <svg
                className="w-6 h-6 text-[#F37167]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-[#403770]">
              Couldn&apos;t reach Google
            </h3>
            <p className="mt-2 text-sm text-[#6E6390] max-w-sm">
              {errorMessage ?? "Something went wrong while syncing. Let's try that again."}
            </p>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="text-5xl mb-4" aria-hidden="true">
        📅
      </div>
      <h3 className="text-lg font-semibold text-[#403770]">All caught up</h3>
      <p className="mt-2 text-sm text-[#6E6390] max-w-sm">
        We couldn&apos;t find any external meetings in that window. Come back
        anytime from settings to sync more history.
      </p>
      <button
        type="button"
        onClick={onClose}
        className="mt-6 inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-[#F37167] rounded-lg hover:bg-[#e0564c] transition-colors"
      >
        Close
      </button>
    </div>
  );
}
