"use client";

import { useDisconnectCalendar, useTriggerCalendarSync } from "@/features/calendar/lib/queries";
import type { CalendarConnection } from "@/features/shared/types/api-types";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  return `${diffDays}d ago`;
}

interface ConnectionStatusCardProps {
  connection: CalendarConnection;
}

export default function ConnectionStatusCard({ connection }: ConnectionStatusCardProps) {
  const disconnectMutation = useDisconnectCalendar();
  const syncMutation = useTriggerCalendarSync();

  return (
    <div className="bg-white rounded-xl border border-[#D4CFE2] p-5">
      <h3 className="text-sm font-semibold text-[#403770] mb-4">Connection</h3>

      <div className="flex items-center gap-3 mb-4">
        {/* Green status dot */}
        <div className="w-2.5 h-2.5 rounded-full bg-[#69B34A] flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#403770] truncate">
            {connection.googleAccountEmail}
          </p>
          <p className="text-xs text-[#8A80A8]">
            Last synced {formatRelativeTime(connection.lastSyncAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#403770] bg-white border border-[#C2BBD4] rounded-lg hover:bg-[#F7F5FA] transition-colors disabled:opacity-50"
        >
          {syncMutation.isPending ? (
            <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.25" />
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          Sync Now
        </button>

        <button
          onClick={() => {
            if (window.confirm("Disconnect your Google Calendar? Synced events will remain as activities.")) {
              disconnectMutation.mutate();
            }
          }}
          disabled={disconnectMutation.isPending}
          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-[#F37167] hover:text-[#e0564c] transition-colors disabled:opacity-50"
        >
          {disconnectMutation.isPending ? "Disconnecting..." : "Disconnect"}
        </button>
      </div>
    </div>
  );
}
