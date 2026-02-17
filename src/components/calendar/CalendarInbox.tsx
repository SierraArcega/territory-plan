// CalendarInbox — Main inbox component for the Activities view
// Shows pending calendar events with smart suggestions for the rep to confirm or dismiss
// Collapsible section with batch actions and sync status
//
// Layout:
// - CalendarConnectBanner (when not connected)
// - Inbox header with pending count + collapse toggle + sync badge
// - List of CalendarEventCard components (when expanded)
// - Batch action bar (when multiple high-confidence events)
// - Empty state (when all caught up)

"use client";

import { useState, useMemo, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  useCalendarConnection,
  useCalendarInbox,
  useBatchConfirmCalendarEvents,
  type CalendarEvent,
} from "@/lib/api";
import CalendarEventCard from "./CalendarEventCard";
import CalendarConnectBanner from "./CalendarConnectBanner";
import CalendarSyncBadge from "./CalendarSyncBadge";

interface CalendarInboxProps {
  // Called when the rep clicks "Edit & Confirm" on a card — opens the activity form pre-filled
  onEditAndConfirm?: (event: CalendarEvent) => void;
}

export default function CalendarInbox({ onEditAndConfirm }: CalendarInboxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showConnectedBanner, setShowConnectedBanner] = useState(false);

  // Show success banner when redirected after calendar connection
  useEffect(() => {
    if (searchParams.get("calendarConnected") === "true") {
      setShowConnectedBanner(true);

      // Strip the calendarConnected param from the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("calendarConnected");
      const newUrl = params.toString() ? `?${params.toString()}` : "/";
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, router]);

  const { data: connectionData, isLoading: connectionLoading } = useCalendarConnection();
  const { data: inboxData, isLoading: inboxLoading } = useCalendarInbox("pending");
  const batchConfirm = useBatchConfirmCalendarEvents();

  // Count high-confidence events for the batch action
  const highConfidenceCount = useMemo(() => {
    if (!inboxData?.events) return 0;
    return inboxData.events.filter((e) => e.matchConfidence === "high").length;
  }, [inboxData?.events]);

  const pendingCount = inboxData?.pendingCount || 0;
  const isConnected = connectionData?.connected;

  // Don't render anything while loading connection status
  if (connectionLoading) return null;

  // If not connected, show the connect banner
  if (!isConnected) {
    return <CalendarConnectBanner />;
  }

  // Success banner shown after OAuth redirect
  const connectedBanner = showConnectedBanner ? (
    <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-[#EDFFE3]/50 rounded-xl border border-[#EDFFE3]">
      <div className="w-7 h-7 rounded-full bg-[#8AA891]/15 flex items-center justify-center flex-shrink-0">
        <svg className="w-4 h-4 text-[#8AA891]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <span className="text-sm text-[#403770]/70">
        Calendar connected! Review your synced meetings below.
      </span>
      <div className="flex-1" />
      <button
        onClick={() => setShowConnectedBanner(false)}
        className="text-[#8AA891] hover:text-[#403770] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  ) : null;

  // If connected but no pending events, show compact "all caught up" state
  if (!inboxLoading && pendingCount === 0) {
    return (
      <>
      {connectedBanner}
      <div className="flex items-center gap-3 px-4 py-3 mb-4 bg-[#EDFFE3]/50 rounded-xl border border-[#EDFFE3]">
        <div className="w-7 h-7 rounded-full bg-[#8AA891]/15 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#8AA891]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <span className="text-sm text-[#403770]/70">
          All caught up — no new meetings to review
        </span>
        <div className="flex-1" />
        <CalendarSyncBadge />
      </div>
      </>
    );
  }

  return (
    <div className="mb-4">
      {connectedBanner}
      {/* Inbox header */}
      <div className="flex items-center gap-3 mb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 group"
        >
          {/* Collapse/expand chevron */}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
              isExpanded ? "rotate-90" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>

          {/* Calendar icon */}
          <div className="w-6 h-6 rounded-md bg-[#403770]/10 flex items-center justify-center">
            <svg className="w-3.5 h-3.5 text-[#403770]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2" />
              <path d="M3 10h18" strokeWidth="2" />
              <path d="M8 2v4M16 2v4" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>

          <span className="text-sm font-semibold text-[#403770] group-hover:text-[#F37167] transition-colors">
            Calendar Inbox
          </span>

          {/* Pending count badge */}
          {pendingCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-[#F37167] rounded-full">
              {pendingCount}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <CalendarSyncBadge />
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="transition-all duration-300">
          {/* Batch action bar — shown when there are multiple high-confidence events */}
          {highConfidenceCount > 1 && (
            <div className="flex items-center gap-2 px-3 py-2 mb-3 bg-[#F37167]/5 rounded-lg border border-[#F37167]/20">
              <svg className="w-4 h-4 text-[#F37167]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs text-[#403770]">
                <span className="font-medium">{highConfidenceCount} strong matches</span>{" "}
                ready to confirm
              </span>
              <div className="flex-1" />
              <button
                onClick={() => batchConfirm.mutate()}
                disabled={batchConfirm.isPending}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-[#F37167] rounded-md hover:bg-[#e0605a] transition-colors disabled:opacity-50"
              >
                {batchConfirm.isPending ? (
                  <>
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Confirming...
                  </>
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Confirm All ({highConfidenceCount})
                  </>
                )}
              </button>
            </div>
          )}

          {/* Loading state */}
          {inboxLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#F37167] border-t-transparent" />
            </div>
          ) : (
            /* Event cards */
            <div>
              {inboxData?.events.map((event) => (
                <CalendarEventCard
                  key={event.id}
                  event={event}
                  onEditAndConfirm={onEditAndConfirm}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
