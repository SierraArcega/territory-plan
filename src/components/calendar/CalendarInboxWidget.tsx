// CalendarInboxWidget — Compact inbox preview for the Home dashboard
// Shows a count of pending calendar events and the top 3 highest-confidence matches
// Links to the full inbox in the Activities view

"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  useCalendarConnection,
  useCalendarInbox,
  useTriggerCalendarSync,
  type CalendarEvent,
} from "@/lib/api";

interface CalendarInboxWidgetProps {
  onNavigateToActivities: () => void;
}

// Compact mini-card for a single calendar event
function MiniEventCard({ event }: { event: CalendarEvent }) {
  const startDate = new Date(event.startTime);
  const timeStr = format(startDate, "MMM d · h:mm a");

  return (
    <div className="flex items-center gap-3 py-2.5">
      {/* Confidence dot */}
      <span
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          event.matchConfidence === "high"
            ? "bg-[#F37167]"
            : event.matchConfidence === "medium"
            ? "bg-[#6EA3BE]"
            : "bg-gray-300"
        }`}
      />

      {/* Event info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#403770] font-medium truncate">
          {event.title}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-xs text-gray-400">{timeStr}</span>
          {event.suggestedDistrictName && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span className="text-xs text-[#403770]/60 truncate">
                {event.suggestedDistrictName}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Match label */}
      {event.matchConfidence === "high" && (
        <span className="text-xs text-[#F37167] font-medium flex-shrink-0">
          Match
        </span>
      )}
    </div>
  );
}

// Human-friendly error messages for each calendarError code
const CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Calendar access was denied. Please try connecting again.",
  no_code: "Something went wrong during authorization. Please try again.",
  state_mismatch: "Security check failed. Please try connecting again.",
  token_exchange_failed: "Could not complete the connection to Google. Please try again.",
};

export default function CalendarInboxWidget({
  onNavigateToActivities,
}: CalendarInboxWidgetProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: connectionData, isLoading: connectionLoading } = useCalendarConnection();
  const { data: inboxData } = useCalendarInbox("pending");
  const syncMutation = useTriggerCalendarSync();

  // Check for calendarError in URL (set by the OAuth callback on failure)
  const [calendarError, setCalendarError] = useState<string | null>(null);
  useEffect(() => {
    const errorCode = searchParams.get("calendarError");
    if (errorCode) {
      setCalendarError(errorCode);
      // Strip the error param from the URL so it doesn't persist on refresh
      const params = new URLSearchParams(searchParams.toString());
      params.delete("calendarError");
      const newUrl = params.toString() ? `?${params.toString()}` : "/";
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  const isConnected = connectionData?.connected;
  const pendingCount = inboxData?.pendingCount || 0;
  const topEvents = inboxData?.events.slice(0, 3) || [];

  // Don't render while loading
  if (connectionLoading) return null;

  // Show error banner if the calendar connection failed
  // Renders above the normal connect CTA so the user sees feedback
  const errorBanner = calendarError ? (
    <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mb-4">
      <div className="px-5 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#403770]">Calendar Connection Failed</p>
          <p className="text-xs text-gray-500">
            {CALENDAR_ERROR_MESSAGES[calendarError] || "An unexpected error occurred. Please try again."}
          </p>
        </div>
        <button
          onClick={() => setCalendarError(null)}
          className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  ) : null;

  // Not connected — show compact connect CTA (with error banner above if present)
  if (!isConnected) {
    return (
      <>
        {errorBanner}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#403770]/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-[#403770]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
                <path d="M3 10h18" strokeWidth="2" />
                <path d="M8 2v4M16 2v4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[#403770]">Calendar Sync</p>
              <p className="text-xs text-gray-400">Connect Google Calendar to auto-track meetings</p>
            </div>
            <a
              href="/api/calendar/connect"
              className="text-xs font-medium text-[#F37167] hover:text-[#e0605a] transition-colors"
            >
              Connect &rarr;
            </a>
          </div>
        </div>
      </>
    );
  }

  // Connected but no pending events
  if (pendingCount === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#EDFFE3]/60 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-[#8AA891]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-[#403770]">Calendar Inbox</p>
            <p className="text-xs text-gray-400">All caught up — no meetings to review</p>
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-[#6EA3BE] hover:text-[#403770] font-medium transition-colors disabled:opacity-50 flex-shrink-0"
          >
            <svg
              className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncMutation.isPending ? "Scanning..." : "Scan"}
          </button>
        </div>
      </div>
    );
  }

  // Connected with pending events — show count + top 3
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-5 pt-5 pb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-[#403770]">Calendar Inbox</h2>
          <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-[#F37167] rounded-full">
            {pendingCount}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="inline-flex items-center gap-1 text-xs text-[#6EA3BE] hover:text-[#403770] font-medium transition-colors disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {syncMutation.isPending ? "Scanning..." : "Scan"}
          </button>
          <button
            onClick={onNavigateToActivities}
            className="text-xs text-gray-400 hover:text-[#403770] transition-colors"
          >
            View all &rarr;
          </button>
        </div>
      </div>

      <div className="px-5 pb-4 divide-y divide-gray-50">
        {topEvents.map((event) => (
          <MiniEventCard key={event.id} event={event} />
        ))}
      </div>

      {pendingCount > 3 && (
        <div className="px-5 pb-4">
          <button
            onClick={onNavigateToActivities}
            className="w-full text-center py-2 text-xs text-[#6EA3BE] hover:text-[#403770] font-medium transition-colors"
          >
            +{pendingCount - 3} more meeting{pendingCount - 3 !== 1 ? "s" : ""} to review
          </button>
        </div>
      )}
    </div>
  );
}
