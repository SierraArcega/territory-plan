// CalendarSyncBadge — Small indicator showing calendar sync status and last sync time
// Includes a manual "Sync Now" button to trigger an on-demand sync
// Shown in the Calendar Inbox header

"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
  useCalendarConnection,
  useTriggerCalendarSync,
} from "@/lib/api";

export default function CalendarSyncBadge() {
  const { data: connectionData } = useCalendarConnection();
  const syncMutation = useTriggerCalendarSync();

  if (!connectionData?.connected || !connectionData.connection) return null;

  const { connection } = connectionData;
  const lastSync = connection.lastSyncAt ? new Date(connection.lastSyncAt) : null;

  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      {/* Connection status dot */}
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          connection.status === "connected"
            ? "bg-green-400"
            : connection.status === "error"
            ? "bg-red-400"
            : "bg-gray-400"
        }`}
      />

      {/* Connected account */}
      <span className="truncate max-w-[160px]" title={connection.googleAccountEmail}>
        {connection.googleAccountEmail}
      </span>

      {/* Last sync time */}
      {lastSync && (
        <span
          className="text-gray-400"
          title={format(lastSync, "MMM d, yyyy h:mm a")}
        >
          · Synced {formatDistanceToNow(lastSync, { addSuffix: true })}
        </span>
      )}

      {/* Sync Now button */}
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

      {/* Sync error */}
      {connection.status === "error" && (
        <span className="text-red-500 text-xs">
          · Connection issue —{" "}
          <a href="/api/calendar/connect" className="underline hover:text-red-600">
            reconnect
          </a>
        </span>
      )}
    </div>
  );
}
