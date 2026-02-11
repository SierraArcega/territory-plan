// CalendarInboxWidget — Compact inbox preview for the Home dashboard
// Shows a count of pending calendar events and the top 3 highest-confidence matches
// Links to the full inbox in the Activities view

"use client";

import { format } from "date-fns";
import {
  useCalendarConnection,
  useCalendarInbox,
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

export default function CalendarInboxWidget({
  onNavigateToActivities,
}: CalendarInboxWidgetProps) {
  const { data: connectionData, isLoading: connectionLoading } = useCalendarConnection();
  const { data: inboxData } = useCalendarInbox("pending");

  const isConnected = connectionData?.connected;
  const pendingCount = inboxData?.pendingCount || 0;
  const topEvents = inboxData?.events.slice(0, 3) || [];

  // Don't render while loading or if not connected
  if (connectionLoading) return null;

  // Not connected — show compact connect CTA
  if (!isConnected) {
    return (
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
        <button
          onClick={onNavigateToActivities}
          className="text-xs text-gray-400 hover:text-[#403770] transition-colors"
        >
          View all &rarr;
        </button>
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
