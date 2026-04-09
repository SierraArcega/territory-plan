// BackfillWizard — Step 2 of the backfill setup. Cycles through pending
// calendar events one at a time, calling the existing confirm/dismiss
// mutations for each decision. Owns its own progress counters and
// keyboard shortcuts (Y/Enter/S/X/Arrows/Esc). When the user blows past
// the last event, calls onComplete.

"use client";

import { useEffect, useState, useCallback } from "react";
import type { CalendarEvent } from "@/features/shared/types/api-types";
import type { ActivityType } from "@/features/activities/types";
import {
  useConfirmCalendarEvent,
  useDismissCalendarEvent,
} from "@/features/calendar/lib/queries";
import BackfillEventCard, {
  type BackfillCardValues,
  initialValuesFromEvent,
} from "./BackfillEventCard";

interface BackfillWizardProps {
  events: CalendarEvent[];
  onComplete: (counts: { confirmed: number; skipped: number; dismissed: number }) => void;
  onClose: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  return false;
}

export default function BackfillWizard({ events, onComplete, onClose }: BackfillWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [confirmedIds, setConfirmedIds] = useState<Set<string>>(() => new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => new Set());
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const confirmMutation = useConfirmCalendarEvent();
  const dismissMutation = useDismissCalendarEvent();

  const currentEvent: CalendarEvent | undefined = events[currentIndex];
  const total = events.length;
  const progressPct = total === 0 ? 0 : Math.min(100, Math.round((currentIndex / total) * 100));

  // Card edit state lives here so keyboard shortcuts (Y/Enter) can access the
  // user's latest edits before submitting. Controlled BackfillEventCard below.
  const [cardValues, setCardValues] = useState<BackfillCardValues>(() =>
    events[0] ? initialValuesFromEvent(events[0]) : {
      title: "",
      activityType: "program_check_in" as ActivityType,
      planIds: [],
      districtLeaids: [],
      notes: "",
    }
  );

  // Reset card state (and clear inline errors) whenever the current event changes
  useEffect(() => {
    if (currentEvent) {
      setCardValues(initialValuesFromEvent(currentEvent));
    }
    setErrorMessage(null);
  }, [currentIndex, currentEvent]);

  // Advance to the next event. Only call this when NOT on the last event —
  // completion is handled by the individual setters below so the final counts
  // reflect the *just-applied* state, not a stale memo.
  const advance = useCallback(() => {
    setCurrentIndex((idx) => Math.min(idx + 1, total - 1));
  }, [total]);

  const isLastEvent = currentIndex + 1 >= total;

  const handleConfirm = useCallback(
    (overrides: BackfillCardValues) => {
      if (!currentEvent) return;
      const eventId = currentEvent.id;
      setErrorMessage(null);
      confirmMutation.mutate(
        {
          eventId,
          activityType: overrides.activityType,
          title: overrides.title.trim() || currentEvent.title,
          planIds: overrides.planIds,
          districtLeaids: overrides.districtLeaids,
          notes: overrides.notes.trim() ? overrides.notes.trim() : undefined,
        },
        {
          onSuccess: () => {
            setConfirmedIds((prev) => {
              const next = new Set(prev).add(eventId);
              if (isLastEvent) {
                queueMicrotask(() =>
                  onComplete({
                    confirmed: next.size,
                    skipped: skippedIds.size,
                    dismissed: dismissedIds.size,
                  })
                );
              }
              return next;
            });
            if (!isLastEvent) advance();
          },
          onError: (err) => {
            setErrorMessage(
              err instanceof Error
                ? err.message
                : "We couldn't save this one. Try again?"
            );
          },
        }
      );
    },
    [
      currentEvent,
      confirmMutation,
      advance,
      isLastEvent,
      onComplete,
      skippedIds,
      dismissedIds,
    ]
  );

  const handleDismiss = useCallback(() => {
    if (!currentEvent) return;
    const eventId = currentEvent.id;
    setErrorMessage(null);
    dismissMutation.mutate(eventId, {
      onSuccess: () => {
        setDismissedIds((prev) => {
          const next = new Set(prev).add(eventId);
          if (isLastEvent) {
            queueMicrotask(() =>
              onComplete({
                confirmed: confirmedIds.size,
                skipped: skippedIds.size,
                dismissed: next.size,
              })
            );
          }
          return next;
        });
        if (!isLastEvent) advance();
      },
      onError: (err) => {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "We couldn't dismiss this one. Try again?"
        );
      },
    });
  }, [
    currentEvent,
    dismissMutation,
    advance,
    isLastEvent,
    onComplete,
    confirmedIds,
    skippedIds,
  ]);

  const handleSkip = useCallback(() => {
    if (!currentEvent) return;
    const eventId = currentEvent.id;
    setErrorMessage(null);
    setSkippedIds((prev) => {
      const next = new Set(prev).add(eventId);
      if (isLastEvent) {
        queueMicrotask(() =>
          onComplete({
            confirmed: confirmedIds.size,
            skipped: next.size,
            dismissed: dismissedIds.size,
          })
        );
      }
      return next;
    });
    if (!isLastEvent) advance();
  }, [
    currentEvent,
    advance,
    isLastEvent,
    onComplete,
    confirmedIds,
    dismissedIds,
  ]);

  const handlePrev = useCallback(() => {
    setCurrentIndex((idx) => Math.max(0, idx - 1));
  }, []);

  const isSaving = confirmMutation.isPending || dismissMutation.isPending;

  // Keyboard shortcuts — skipped when focus is inside a form input/textarea/select.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      // Don't swallow modifier-key combinations
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "Escape":
          e.preventDefault();
          onClose();
          break;
        case "ArrowLeft":
          e.preventDefault();
          handlePrev();
          break;
        case "ArrowRight":
          e.preventDefault();
          handleSkip();
          break;
        case "y":
        case "Y":
        case "Enter":
          e.preventDefault();
          // Confirm with the *current* edited card values (not the raw
          // suggestions) so keyboard confirm respects user edits.
          if (currentEvent) {
            handleConfirm(cardValues);
          }
          break;
        case "s":
        case "S":
          e.preventDefault();
          handleSkip();
          break;
        case "x":
        case "X":
          e.preventDefault();
          handleDismiss();
          break;
        default:
          break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [currentEvent, cardValues, handleConfirm, handleDismiss, handleSkip, handlePrev, onClose]);

  if (total === 0 || !currentEvent) {
    return null;
  }

  const displayCounts = {
    confirmed: confirmedIds.size,
    skipped: skippedIds.size,
    dismissed: dismissedIds.size,
  };

  return (
    <div className="flex flex-col h-full" data-testid="backfill-wizard">
      {/* Sticky header strip */}
      <div className="sticky top-0 z-10 bg-white border-b border-[#E2DEEC] px-6 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex-1">
            <div className="text-sm font-semibold text-[#403770]">
              Event {Math.min(currentIndex + 1, total)} of {total}
              <span className="ml-2 text-[#8A80A8] font-normal">· {progressPct}%</span>
            </div>
            <div className="mt-0.5 text-xs text-[#6E6390]">
              {displayCounts.confirmed} confirmed · {displayCounts.skipped} skipped ·{" "}
              {displayCounts.dismissed} dismissed
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors"
            aria-label="Close wizard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="h-1.5 rounded-full bg-[#EFEDF5] overflow-hidden">
          <div
            className="h-full bg-[#F37167] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPct}
            aria-label="Backfill progress"
          />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <BackfillEventCard
          key={currentEvent.id}
          event={currentEvent}
          values={cardValues}
          onValuesChange={setCardValues}
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          onDismiss={handleDismiss}
          isSaving={isSaving}
          errorMessage={errorMessage}
        />
      </div>

      {/* Footer actions */}
      <div className="sticky bottom-0 bg-white border-t border-[#E2DEEC] px-6 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentIndex === 0 || isSaving}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-[#6E6390] hover:text-[#403770] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span aria-hidden="true">‹</span> Prev
        </button>
        <div className="flex-1 text-center text-[11px] text-[#A69DC0]">
          Y / Enter = confirm · S = skip · X = dismiss · ← → prev/next · Esc = close
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
        >
          Save &amp; finish later
        </button>
      </div>
    </div>
  );
}
