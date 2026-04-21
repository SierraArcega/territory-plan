"use client";

import { useEffect, useState } from "react";
import { useCalendarConnection, useTriggerCalendarSync } from "@/lib/api";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const STATE_STYLES = {
  connected: { dot: "bg-[#69B34A]", text: "text-[#5f665b]", bg: "bg-[#F7FFF2]", border: "border-[#8AC670]" },
  stale: { dot: "bg-[#FFCF70]", text: "text-[#997c43]", bg: "bg-[#fffaf1]", border: "border-[#ffd98d]" },
  disconnected: { dot: "bg-[#F37167]", text: "text-[#c25a52]", bg: "bg-[#fef1f0]", border: "border-[#f58d85]" },
} as const;

export default function CalendarSyncBadge() {
  const { data, isLoading } = useCalendarConnection();
  const sync = useTriggerCalendarSync();
  const setSyncState = useActivitiesChrome((s) => s.setSyncState);
  const syncState = useActivitiesChrome((s) => s.syncState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!data?.connected) setSyncState("disconnected");
    else setSyncState("connected");
  }, [data, isLoading, setSyncState]);

  const styles = STATE_STYLES[syncState];
  const label =
    syncState === "connected" ? "Synced" : syncState === "stale" ? "Stale" : "Disconnected";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Calendar sync: ${label}`}
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${styles.bg} ${styles.text} ${styles.border} transition-colors`}
      >
        <span
          className={`w-2 h-2 rounded-full ${styles.dot} ${syncState === "connected" ? "animate-pulse" : ""}`}
        />
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Calendar sync details"
          className="absolute right-0 top-full mt-1.5 z-30 w-[300px] bg-white border border-[#E2DEEC] rounded-xl shadow-lg p-4"
          onMouseLeave={() => setOpen(false)}
        >
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
            Calendar
          </div>
          <div className="text-sm font-medium text-[#403770] mb-1">
            {data?.connected
              ? data?.connection?.googleAccountEmail || "Connected"
              : "Not connected"}
          </div>
          <div className="text-xs text-[#8A80A8] mb-3">
            {syncState === "connected"
              ? "Two-way sync is active."
              : syncState === "stale"
              ? "Last sync was a while ago."
              : "Connect Google Calendar to pull events into Activities."}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!data?.connected || sync.isPending}
              onClick={() => sync.mutate()}
              className="px-2.5 py-1 text-xs font-medium rounded-md bg-[#403770] text-white disabled:opacity-50 hover:bg-[#322a5a] transition-colors"
            >
              {sync.isPending ? "Syncing…" : "Sync now"}
            </button>
            <a
              href="/settings/integrations"
              className="px-2.5 py-1 text-xs font-medium rounded-md text-[#403770] hover:bg-[#F7F5FA] transition-colors"
            >
              {data?.connected ? "Reconnect" : "Connect"}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
