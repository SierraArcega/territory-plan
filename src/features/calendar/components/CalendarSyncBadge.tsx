// CalendarSyncBadge — Small indicator showing calendar sync status and last sync time
// Includes a manual "Sync Now" button to trigger an on-demand sync
// Shown in the Calendar Inbox header

"use client";

import { format, formatDistanceToNow } from "date-fns";
import { useTriggerCalendarSync } from "@/lib/api";
import { useCalendarSyncState } from "@/features/calendar/lib/useCalendarSyncState";

const DOT_CLASS = {
  connected: "bg-[#69B34A]",
  stale: "bg-[#FFCF70]",
  disconnected: "bg-[#F37167]",
} as const;

export default function CalendarSyncBadge() {
  const { state, lastSyncAt, email, data } = useCalendarSyncState();
  const syncMutation = useTriggerCalendarSync();

  if (!data?.connected || !data.connection) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-[#8A80A8]">
      <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[state]}`} />

      <span className="truncate max-w-[160px]" title={email ?? undefined}>
        {email}
      </span>

      {lastSyncAt && (
        <span
          className="text-[#A69DC0]"
          title={format(lastSyncAt, "MMM d, yyyy h:mm a")}
        >
          · Synced {formatDistanceToNow(lastSyncAt, { addSuffix: true })}
        </span>
      )}

      <button
        onClick={() => syncMutation.mutate()}
        disabled={syncMutation.isPending}
        className="ml-1 inline-flex items-center gap-1 text-[#6EA3BE] hover:text-[#403770] transition-colors disabled:opacity-50"
        title="Sync now"
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
        {syncMutation.isPending ? "Syncing..." : "Sync"}
      </button>

      {state === "disconnected" && data.connection.status === "error" && (
        <span className="text-[#c25a52] text-xs">
          · Connection issue —{" "}
          <a href="/api/calendar/connect" className="underline hover:text-[#a04a44]">
            reconnect
          </a>
        </span>
      )}
    </div>
  );
}
