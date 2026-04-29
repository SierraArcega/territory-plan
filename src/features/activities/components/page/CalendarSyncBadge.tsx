"use client";

import { useEffect, useRef, useState } from "react";
import { useTriggerCalendarSync } from "@/lib/api";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import { useCalendarSyncState } from "@/features/calendar/lib/useCalendarSyncState";

const STATE_STYLES = {
  connected: { dot: "bg-[#69B34A]", text: "text-[#5f665b]", bg: "bg-[#F7FFF2]", border: "border-[#8AC670]" },
  stale: { dot: "bg-[#FFCF70]", text: "text-[#997c43]", bg: "bg-[#fffaf1]", border: "border-[#ffd98d]" },
  disconnected: { dot: "bg-[#F37167]", text: "text-[#c25a52]", bg: "bg-[#fef1f0]", border: "border-[#f58d85]" },
} as const;

interface CalendarSyncBadgeProps {
  /** When provided, the "Review N pending" CTA opens this callback instead
   *  of navigating to /?tab=feed — letting the host page open an inline
   *  modal/drawer for the calendar inbox. */
  onReviewPending?: () => void;
}

export default function CalendarSyncBadge({
  onReviewPending,
}: CalendarSyncBadgeProps = {}) {
  const { state, isLoading, email, pendingCount, data } = useCalendarSyncState();
  const sync = useTriggerCalendarSync();
  const setSyncState = useActivitiesChrome((s) => s.setSyncState);
  const [open, setOpen] = useState(false);
  // Hold-open shield: keep the popover from auto-closing while a sync is
  // in flight or for ~2s after it lands, so the user actually sees the
  // result before mouse-leave dismisses the panel.
  const stickyRef = useRef<number | null>(null);
  if (sync.isPending) stickyRef.current = Date.now();
  const sticky =
    sync.isPending ||
    (stickyRef.current !== null && Date.now() - stickyRef.current < 2000);

  // Mirror derived state into the chrome store so other components reading
  // useActivitiesChrome((s) => s.syncState) stay in sync without needing the hook.
  useEffect(() => {
    if (isLoading) return;
    setSyncState(state);
  }, [state, isLoading, setSyncState]);

  // Auto-trigger a sync when the rep just finished an OAuth reconnect — the
  // callback redirects with ?calendarReconnected=true. We open the popover so
  // they see "Syncing…" → result, then strip the marker from the URL so
  // refreshing the page doesn't re-fire the sync.
  const syncMutate = sync.mutate;
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("calendarReconnected") !== "true") return;
    if (!data?.connected) return;
    setOpen(true);
    syncMutate();
    url.searchParams.delete("calendarReconnected");
    window.history.replaceState(
      {},
      "",
      url.pathname + (url.search ? url.search : "") + url.hash
    );
  }, [data?.connected, syncMutate]);

  const styles = STATE_STYLES[state];
  const label =
    state === "connected" ? "Synced" : state === "stale" ? "Stale" : "Disconnected";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Calendar sync: ${label}`}
        className={`fm-focus-ring inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium border ${styles.bg} ${styles.text} ${styles.border} [transition-duration:120ms] transition-colors`}
      >
        <span className="relative inline-block w-2 h-2">
          <span
            className={`absolute inset-0 rounded-full ${styles.dot}`}
            aria-hidden
          />
          {state === "connected" && (
            <span
              className={`absolute -inset-[3px] rounded-full ${styles.dot} opacity-35`}
              style={{ animation: "fmPulseDot 1.8s ease-out infinite" }}
              aria-hidden
            />
          )}
        </span>
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Calendar sync details"
          className="absolute right-0 top-full mt-1.5 z-30 w-[300px] bg-white border border-[#E2DEEC] rounded-xl shadow-lg p-4"
          onMouseLeave={() => {
            if (sticky) return;
            setOpen(false);
          }}
        >
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-2">
            Calendar
          </div>
          <div className="text-sm font-medium text-[#403770] mb-1">
            {data?.connected ? email || "Connected" : "Not connected"}
          </div>
          <div className="text-xs text-[#8A80A8] mb-3">
            {state === "connected"
              ? "Two-way sync is active."
              : state === "stale"
              ? "Last sync was a while ago."
              : "Connect Google Calendar to pull events into Activities."}
          </div>
          {pendingCount > 0 &&
            (onReviewPending ? (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReviewPending();
                }}
                className="fm-focus-ring w-full flex items-center justify-between mb-3 px-3 py-2 rounded-md bg-[#FFF8E1] border border-[#FFD98D] text-[11px] font-semibold text-[#7A5A18] hover:bg-[#FFEFC2] [transition-duration:120ms] transition-colors"
              >
                <span>
                  Review {pendingCount} pending event
                  {pendingCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden className="text-[#7A5A18]">
                  →
                </span>
              </button>
            ) : (
              <a
                href="/?tab=feed"
                className="fm-focus-ring flex items-center justify-between mb-3 px-3 py-2 rounded-md bg-[#FFF8E1] border border-[#FFD98D] text-[11px] font-semibold text-[#7A5A18] hover:bg-[#FFEFC2] [transition-duration:120ms] transition-colors"
              >
                <span>
                  Review {pendingCount} pending event
                  {pendingCount === 1 ? "" : "s"}
                </span>
                <span aria-hidden className="text-[#7A5A18]">
                  →
                </span>
              </a>
            ))}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={!data?.connected || sync.isPending}
              onClick={() => sync.mutate()}
              className="fm-focus-ring px-2.5 py-1 text-xs font-medium rounded-md bg-[#403770] text-white disabled:opacity-50 hover:bg-[#322a5a] [transition-duration:120ms] transition-colors"
            >
              {sync.isPending ? "Syncing…" : "Sync now"}
            </button>
            <a
              // Goes straight to Google OAuth via /api/calendar/connect, which
              // re-runs consent and re-encrypts tokens with the current
              // ENCRYPTION_KEY. The callback returns the rep here.
              href={`/api/calendar/connect?returnTo=${encodeURIComponent(
                typeof window !== "undefined"
                  ? window.location.pathname + window.location.search
                  : "/"
              )}`}
              className="fm-focus-ring px-2.5 py-1 text-xs font-medium rounded-md text-[#403770] hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors"
            >
              {data?.connected ? "Reconnect" : "Connect"}
            </a>
          </div>
          {sync.error && (
            <div
              role="alert"
              className="mt-3 px-2 py-1.5 rounded-md bg-[#FEF1F0] border border-[#F5C9C5] text-[11px] text-[#9B3A2E]"
            >
              {sync.error instanceof Error
                ? sync.error.message
                : "Sync failed. Try Reconnect."}
            </div>
          )}
          {sync.isSuccess && !sync.isPending && sync.data && (
            <div className="mt-3 px-2 py-1.5 rounded-md bg-[#EDFFE3] border border-[#B8E0A1] text-[11px] text-[#2D6B4D]">
              {(() => {
                const r = sync.data as {
                  eventsProcessed?: number;
                  newEvents?: number;
                };
                const n =
                  typeof r.newEvents === "number"
                    ? r.newEvents
                    : r.eventsProcessed ?? 0;
                if (n === 0) return "Up to date — no new events.";
                return `Synced ${n} event${n === 1 ? "" : "s"}.`;
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
