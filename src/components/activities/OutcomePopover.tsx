// OutcomePopover — Appears when an activity is marked "completed"
// Shows category-specific outcome pills (e.g. "Moved Forward", "Got Reply")
// with an optional quick note, then saves the outcome to the activity.
// Designed to be lightweight and non-blocking — "Skip" dismisses without tagging.

"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateActivity, type ActivityListItem } from "@/lib/api";
import { getCategoryForType, type ActivityType } from "@/lib/activityTypes";
import {
  OUTCOMES_BY_CATEGORY,
  OUTCOME_CONFIGS,
  type OutcomeType,
} from "@/lib/outcomeTypes";

interface OutcomePopoverProps {
  activity: ActivityListItem;
  /** Anchor element to position the popover near */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

export default function OutcomePopover({
  activity,
  anchorRef,
  onClose,
}: OutcomePopoverProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeType | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const updateActivity = useUpdateActivity();

  const category = getCategoryForType(activity.type as ActivityType);
  const outcomes = OUTCOMES_BY_CATEGORY[category];

  // Position the popover below (or above) the anchor element
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!anchorRef.current || !popoverRef.current) return;

    const anchorRect = anchorRef.current.getBoundingClientRect();
    const popoverRect = popoverRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Try to place below the anchor, centered horizontally
    let top = anchorRect.bottom + 8;
    let left = anchorRect.left + anchorRect.width / 2 - popoverRect.width / 2;

    // If it would overflow the bottom, place above instead
    if (top + popoverRect.height > viewportHeight - 16) {
      top = anchorRect.top - popoverRect.height - 8;
    }

    // Keep within horizontal bounds
    left = Math.max(16, Math.min(left, window.innerWidth - popoverRect.width - 16));

    setPosition({ top, left });
  }, [anchorRef]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    // Delay to avoid the click that opened the popover from immediately closing it
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const handleSave = async () => {
    if (!selectedOutcome) return;

    await updateActivity.mutateAsync({
      activityId: activity.id,
      outcomeType: selectedOutcome,
      outcome: note.trim() || null,
    });
    onClose();
  };

  return (
    <>
      {/* Backdrop — semi-transparent to focus attention on the popover */}
      <div className="fixed inset-0 z-40 bg-black/10" />

      {/* Popover card */}
      <div
        ref={popoverRef}
        className="fixed z-50 animate-in fade-in slide-in-from-top-2 duration-200"
        style={{ top: position.top, left: position.left }}
      >
        <div className="bg-white rounded-xl shadow-xl border border-gray-100 w-[320px] overflow-hidden">
          {/* Header */}
          <div className="px-4 pt-4 pb-2">
            <p className="text-sm font-semibold text-[#403770]">
              What happened?
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              Tag what resulted from this activity
            </p>
          </div>

          {/* Outcome pills */}
          <div className="px-4 pb-3 flex flex-wrap gap-2">
            {outcomes.map((outcomeType) => {
              const config = OUTCOME_CONFIGS[outcomeType];
              const isSelected = selectedOutcome === outcomeType;

              return (
                <button
                  key={outcomeType}
                  onClick={() =>
                    setSelectedOutcome(isSelected ? null : outcomeType)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150"
                  style={{
                    backgroundColor: isSelected ? config.color : config.bgColor,
                    color: isSelected ? "#fff" : config.color,
                    // Subtle ring when selected for extra clarity
                    boxShadow: isSelected
                      ? `0 0 0 2px ${config.color}40`
                      : "none",
                  }}
                >
                  <span className="text-sm">{config.icon}</span>
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Quick note toggle + textarea */}
          {!showNote ? (
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowNote(true)}
                className="text-xs text-gray-400 hover:text-[#403770] transition-colors"
              >
                + Add a quick note
              </button>
            </div>
          ) : (
            <div className="px-4 pb-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="How did it go? (optional)"
                rows={2}
                autoFocus
                className="w-full px-3 py-2 text-sm text-[#403770] bg-gray-50 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-gray-400"
              />
            </div>
          )}

          {/* Actions */}
          <div className="px-4 pb-4 flex items-center justify-between gap-2">
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleSave}
              disabled={!selectedOutcome || updateActivity.isPending}
              className="px-4 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {updateActivity.isPending ? "Saving..." : "Save"}
            </button>
          </div>

          {/* Auto-task hint — shown when selected outcome creates a follow-up */}
          {selectedOutcome && OUTCOME_CONFIGS[selectedOutcome].autoTask && (
            <div className="px-4 pb-3 -mt-1">
              <p className="text-[11px] text-[#6EA3BE] flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                This will create a{" "}
                {OUTCOME_CONFIGS[selectedOutcome].autoTask === "follow_up"
                  ? "follow-up task"
                  : "prep task"}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
