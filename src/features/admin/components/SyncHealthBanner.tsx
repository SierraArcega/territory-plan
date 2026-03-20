"use client";

import { useAdminSyncHealth } from "../hooks/useAdminSyncHealth";

function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatTimestamp(date: string | null): string {
  if (!date) return "—";
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const HEALTH_CONFIG = {
  green: {
    dot: "bg-[#8AA891]",
    border: "border-[#8AA891]/30",
    bg: "bg-[#EDFFE3]/40",
    label: "Healthy",
  },
  yellow: {
    dot: "bg-[#E5A53D]",
    border: "border-[#E5A53D]/30",
    bg: "bg-[#FFF7E0]/40",
    label: "Stale",
  },
  red: {
    dot: "bg-[#F37167]",
    border: "border-[#F37167]/30",
    bg: "bg-[#FFF0EE]/40",
    label: "Down",
  },
} as const;

export default function SyncHealthBanner() {
  const { data, isLoading } = useAdminSyncHealth();

  if (isLoading) {
    return (
      <div className="rounded-xl border border-[#E2DEEC] bg-white p-4 animate-pulse">
        <div className="h-4 w-48 bg-[#E2DEEC]/60 rounded" />
      </div>
    );
  }

  if (!data) return null;

  const config = HEALTH_CONFIG[data.health];

  return (
    <div
      className={`rounded-xl border ${config.border} ${config.bg} p-4 space-y-3`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`w-2.5 h-2.5 rounded-full ${config.dot}`} />
          <span className="text-sm font-semibold text-[#403770]">
            Railway Sync
          </span>
          <span
            className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${config.border} ${config.bg} text-[#6E6390]`}
          >
            {config.label}
          </span>
        </div>
        <span className="text-xs text-[#8A80A8]">
          Refreshes every minute
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="Last Sync"
          value={relativeTime(data.lastSyncAt)}
          detail={formatTimestamp(data.lastSyncAt)}
        />
        <Stat
          label="Opportunities"
          value={data.opportunities.total.toLocaleString()}
          detail={`Synced ${relativeTime(data.opportunities.lastSynced)}`}
        />
        <Stat
          label="Sessions"
          value={data.sessions.total.toLocaleString()}
          detail={`Synced ${relativeTime(data.sessions.lastSynced)}`}
        />
        <Stat
          label="Unmatched"
          value={data.unmatched.total.toLocaleString()}
          detail={`Last updated ${relativeTime(data.unmatched.lastSynced)}`}
        />
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div>
      <div className="text-[11px] text-[#8A80A8] font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-lg font-bold text-[#403770] mt-0.5">{value}</div>
      <div className="text-[11px] text-[#A69DC0] mt-0.5">{detail}</div>
    </div>
  );
}
