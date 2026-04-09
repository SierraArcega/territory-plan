// BackfillWizard — Step 2 of the backfill setup. Cycles through pending
// calendar events one at a time, calling the existing confirm/dismiss
// mutations for each decision. Owns its own progress counters and
// keyboard shortcuts (Y/Enter/S/X/Arrows/Esc). When the user blows past
// the last event, calls onComplete.

"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import type { CalendarEvent } from "@/features/shared/types/api-types";
import {
  useConfirmCalendarEvent,
  useDismissCalendarEvent,
} from "@/features/calendar/lib/queries";
import BackfillEventCard, {
  type BackfillConfirmOverrides,
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

  const confirmMutation = useConfirmCalendarEvent();
  const dismissMutation = useDismissCalendarEvent();

  const currentEvent: CalendarEvent | undefined = events[currentIndex];
  const total = events.length;
  const progressPct = total === 0 ? 0 : Math.min(100, Math.round((currentIndex / total) * 100));

  const counts = useMemo(
    () => ({
      confirmed: confirmedIds.size,
      skipped: skippedIds.size,
      dismissed: dismissedIds.size,
    }),
    [confirmedIds, skippedIds, dismissedIds]
  );

  const advance = useCallback(() => {
    setCurrentIndex((idx) => {
      const next = idx + 1;
      if (next >= total) {
        // Defer onComplete until after the state update settles
        queueMicrotask(() => onComplete(counts));
        return idx;
      }
      return next;
    });
  }, [total, onComplete, counts]);

  const handleConfirm = useCallback(
    (overrides: BackfillConfirmOverrides) => {
      if (!currentEvent) return;
      const eventId = currentEvent.id;
      confirmMutation.mutate(
        {
          eventId,
          activityType: overrides.activityType,
          title: overrides.title,
          planIds: overrides.planIds,
          districtLeaids: overrides.districtLeaids,
          notes: overrides.notes ?? undefined,
        },
        {
          onSuccess: () => {
            setConfirmedIds((prev) => new Set(prev).add(eventId));
            advance();
          },
        }
      );
    },
    [currentEvent, confirmMutation, advance]
  );

  const handleDismiss = useCallback(() => {
    if (!currentEvent) return;
    const eventId = currentEvent.id;
    dismissMutation.mutate(eventId, {
      onSuccess: () => {
        setDismissedIds((prev) => new Set(prev).add(eventId));
        advance();
      },
    });
  }, [currentEvent, dismissMutation, advance]);

  const handleSkip = useCallback(() => {
    if (!currentEvent) return;
    setSkippedIds((prev) => new Set(prev).add(currentEvent.id));
    advance();
  }, [currentEvent, advance]);

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
          // Fire confirm with the *current* card state. Since the card owns
          // its edit state we can't reach into it, so keyboard confirm uses
          // the suggestions directly. The user can still click Save & Next
          // after editing to send edited values.
          if (currentEvent) {
            handleConfirm({
              activityType:
                (currentEvent.suggestedActivityType as BackfillConfirmOverrides["activityType"]) ??
                "program_check_in",
              title: currentEvent.title,
              planIds: currentEvent.suggestedPlanId ? [currentEvent.suggestedPlanId] : [],
              districtLeaids: currentEvent.suggestedDistrictId
                ? [currentEvent.suggestedDistrictId]
                : [],
              notes: currentEvent.description ?? null,
            });
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
  }, [currentEvent, handleConfirm, handleDismiss, handleSkip, handlePrev, onClose]);

  if (total === 0 || !currentEvent) {
    return null;
  }

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
              {counts.confirmed} confirmed · {counts.skipped} skipped · {counts.dismissed}{" "}
              dismissed
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
          onConfirm={handleConfirm}
          onSkip={handleSkip}
          onDismiss={handleDismiss}
          isSaving={isSaving}
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
