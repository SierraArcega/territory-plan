"use client";

import { useCalendarConnection } from "@/features/calendar/lib/queries";
import ConnectionStatusCard from "@/features/calendar/components/ConnectionStatusCard";
import SyncDirectionCard from "@/features/calendar/components/SyncDirectionCard";
import ActivityTypeFiltersCard from "@/features/calendar/components/ActivityTypeFiltersCard";
import RemindersCard from "@/features/calendar/components/RemindersCard";

export default function CalendarSyncSettings() {
  const { data, isLoading } = useCalendarConnection();

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-[#D4CFE2] p-5 animate-pulse"
          >
            <div className="h-4 w-24 bg-[#E2DEEC] rounded mb-4" />
            <div className="h-3 w-48 bg-[#E2DEEC] rounded mb-2" />
            <div className="h-3 w-32 bg-[#E2DEEC] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const connected = data?.connected ?? false;
  const connection = data?.connection ?? null;

  return (
    <div className="space-y-4">
      {/* Connection status / connect banner */}
      {connected && connection ? (
        <ConnectionStatusCard connection={connection} />
      ) : (
        <div
          className="relative overflow-hidden rounded-xl border border-[#403770]/20"
          style={{
            background: "linear-gradient(135deg, #403770 0%, #4e3d7a 40%, #5c4785 70%, #6b5a90 100%)",
          }}
        >
          <div className="flex items-center gap-4 px-5 py-4">
            <div className="w-10 h-10 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
                <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
                <path d="M8 2v4M16 2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <circle cx="12" cy="16" r="2" fill="currentColor" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-white">
                Connect your Google Calendar
              </h3>
              <p className="text-xs text-white/60 mt-0.5">
                Sync meetings and activities between your calendar and the app.
              </p>
            </div>
            <button
              onClick={() => { window.location.href = "/api/calendar/connect"; }}
              className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-[#403770] bg-white rounded-lg hover:bg-white/90 transition-colors"
            >
              Connect
            </button>
          </div>
        </div>
      )}

      {/* Config cards — locked when disconnected */}
      <div className={connected ? "" : "relative"}>
        {!connected && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
            <p className="text-sm font-medium text-[#6E6390] bg-[#F7F5FA]/90 px-4 py-2 rounded-lg border border-[#D4CFE2]">
              Connect your calendar to configure sync
            </p>
          </div>
        )}

        <div className={`space-y-4 ${!connected ? "opacity-50 pointer-events-none" : ""}`}>
          <SyncDirectionCard
            value={connection?.syncDirection ?? "two_way"}
          />
          <ActivityTypeFiltersCard
            value={connection?.syncedActivityTypes ?? []}
          />
          <RemindersCard
            reminderMinutes={connection?.reminderMinutes ?? 15}
            secondReminderMinutes={connection?.secondReminderMinutes ?? null}
          />
        </div>
      </div>
    </div>
  );
}
