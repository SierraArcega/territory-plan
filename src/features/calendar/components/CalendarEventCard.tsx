// CalendarEventCard — Renders a single calendar event in the inbox
// Shows event title, time, attendees, smart match suggestions, and confirm/dismiss actions
// Left accent border colored by confidence level (coral=high, steel-blue=medium, gray=low)

"use client";

import { useState } from "react";
import { format } from "date-fns";
import {
  useConfirmCalendarEvent,
  useDismissCalendarEvent,
  type CalendarEvent,
} from "@/lib/api";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  type ActivityType,
} from "@/features/activities/types";
import OutcomeModal from "@/features/activities/components/OutcomeModal";

// Confidence level → left border color
const CONFIDENCE_COLORS: Record<string, string> = {
  high: "border-l-[#F37167]",   // coral — strong match
  medium: "border-l-[#6EA3BE]", // steel-blue — partial match
  low: "border-l-gray-300",     // gray — no match, still worth reviewing
  none: "border-l-gray-200",
};

const CONFIDENCE_LABELS: Record<string, string> = {
  high: "Strong match",
  medium: "Possible match",
  low: "No match found",
  none: "No match found",
};

interface CalendarEventCardProps {
  event: CalendarEvent;
  onEditAndConfirm?: (event: CalendarEvent) => void;
}

export default function CalendarEventCard({
  event,
  onEditAndConfirm,
}: CalendarEventCardProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [createdActivityId, setCreatedActivityId] = useState<string | null>(null);

  const confirmMutation = useConfirmCalendarEvent();
  const dismissMutation = useDismissCalendarEvent();

  const isProcessing = confirmMutation.isPending || dismissMutation.isPending;

  // Format the event time range
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);
  const isSameDay =
    startDate.toDateString() === endDate.toDateString();
  const timeDisplay = isSameDay
    ? `${format(startDate, "MMM d")} · ${format(startDate, "h:mm a")} – ${format(endDate, "h:mm a")}`
    : `${format(startDate, "MMM d, h:mm a")} – ${format(endDate, "MMM d, h:mm a")}`;

  // Is this event in the past? (helps determine auto-status: completed vs planned)
  const isPast = startDate < new Date();

  // Handle confirm — creates Activity with smart suggestions
  // If the event is in the past, show the OutcomeModal after confirming
  const handleConfirm = async () => {
    setIsExiting(true);
    try {
      const result = await confirmMutation.mutateAsync({ eventId: event.id });
      if (isPast && result.activityId) {
        setCreatedActivityId(result.activityId);
        setShowOutcomeModal(true);
      }
    } catch {
      setIsExiting(false);
    }
  };

  // Handle dismiss — hides from inbox
  const handleDismiss = async () => {
    setIsExiting(true);
    try {
      await dismissMutation.mutateAsync(event.id);
    } catch {
      setIsExiting(false);
    }
  };

  const confidenceBorder = CONFIDENCE_COLORS[event.matchConfidence] || CONFIDENCE_COLORS.none;
  const suggestedTypeLabel = event.suggestedActivityType
    ? ACTIVITY_TYPE_LABELS[event.suggestedActivityType as ActivityType]
    : null;
  const suggestedTypeIcon = event.suggestedActivityType
    ? ACTIVITY_TYPE_ICONS[event.suggestedActivityType as ActivityType]
    : null;

  return (
    <>
    <div
      className={`
        bg-white rounded-lg border border-gray-200 border-l-4 ${confidenceBorder}
        transition-all duration-300 ease-out
        ${isExiting ? "opacity-0 -translate-x-4 max-h-0 overflow-hidden mb-0" : "opacity-100 translate-x-0 max-h-96 mb-3"}
        ${isProcessing ? "pointer-events-none" : ""}
      `}
    >
      <div className="px-4 py-3">
        {/* Top row: title + time */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-[#403770] truncate">
              {event.title}
            </h3>
            {/* Suggested type badge */}
            {suggestedTypeLabel && (
              <span className="inline-flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                <span>{suggestedTypeIcon}</span>
                {suggestedTypeLabel}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
            <span>{timeDisplay}</span>
            {isPast && (
              <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                Past
              </span>
            )}
          </div>
        </div>

        {/* Attendee chips */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {event.attendees.map((attendee, i) => {
            // Check if this attendee matched a contact
            const matchedContact = event.suggestedContacts.find(
              (c) => c.email?.toLowerCase() === attendee.email.toLowerCase()
            );

            return matchedContact ? (
              // Matched contact — plum pill with district info
              <span
                key={i}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#403770]/10 text-[#403770]"
                title={`${matchedContact.name} — ${matchedContact.title || "Contact"}`}
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {matchedContact.name}
              </span>
            ) : (
              // Unmatched external attendee — coral-tinted pill
              <span
                key={i}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-[#F37167]/10 text-[#F37167]"
                title={attendee.email}
              >
                {attendee.name || attendee.email}
              </span>
            );
          })}
        </div>

        {/* Smart suggestion banner — shown when we have a district/plan match */}
        {(event.suggestedDistrictName || event.suggestedPlanName) && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-[#C4E7E6]/30 mb-3">
            {/* Confidence dot */}
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                event.matchConfidence === "high"
                  ? "bg-[#F37167]"
                  : event.matchConfidence === "medium"
                  ? "bg-[#6EA3BE]"
                  : "bg-gray-400"
              }`}
            />
            <span className="text-xs text-[#403770]">
              {event.matchConfidence === "high" ? "Matches " : "Possible match: "}
              {event.suggestedContacts.length > 0 && (
                <span className="font-medium">
                  {event.suggestedContacts.map((c) => c.name).join(", ")}
                </span>
              )}
              {event.suggestedDistrictName && (
                <>
                  {event.suggestedContacts.length > 0 && " at "}
                  <span className="font-medium">
                    {event.suggestedDistrictName}
                    {event.suggestedDistrictState && ` (${event.suggestedDistrictState})`}
                  </span>
                </>
              )}
              {event.suggestedPlanName && (
                <>
                  {" → "}
                  <span className="inline-flex items-center gap-1">
                    {event.suggestedPlanColor && (
                      <span
                        className="w-2 h-2 rounded-full inline-block"
                        style={{ backgroundColor: event.suggestedPlanColor }}
                      />
                    )}
                    <span className="font-medium">{event.suggestedPlanName}</span>
                  </span>
                </>
              )}
            </span>
            <span className="ml-auto text-xs text-gray-400 flex-shrink-0">
              {CONFIDENCE_LABELS[event.matchConfidence]}
            </span>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#F37167] rounded-md hover:bg-[#e0605a] transition-colors disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Confirm
          </button>

          {onEditAndConfirm && (
            <button
              onClick={() => onEditAndConfirm(event)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F37167] border border-[#F37167] rounded-md hover:bg-[#F37167]/5 transition-colors disabled:opacity-50"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit & Confirm
            </button>
          )}

          <div className="flex-1" />

          <button
            onClick={handleDismiss}
            disabled={isProcessing}
            className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>

    {/* OutcomeModal — shown after confirming a past event */}
    {showOutcomeModal && createdActivityId && (
      <OutcomeModal
        activity={{
          id: createdActivityId,
          type: event.suggestedActivityType || "customer_check_in",
          title: event.title,
        }}
        sourceContext={{
          planIds: event.suggestedPlanId ? [event.suggestedPlanId] : undefined,
          districtLeaids: event.suggestedDistrictId ? [event.suggestedDistrictId] : undefined,
          contactIds: event.suggestedContactIds || undefined,
        }}
        onClose={() => setShowOutcomeModal(false)}
      />
    )}
    </>
  );
}
