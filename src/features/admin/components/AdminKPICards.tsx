"use client";

interface AdminStats {
  unmatched: { total: number; newThisWeek: number };
  users: { total: number; activeToday: number };
  integrations: { total: number; errors: number };
  sync: { status: string; recentErrors: number; lastSyncAt: string | null };
}

interface KPICardProps {
  accent: string;
  label: string;
  value: string;
  subtitle: string;
  onClick?: () => void;
}

function KPICard({ accent, label, value, subtitle, onClick }: KPICardProps) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden text-left transition-colors hover:border-[#403770]/30 cursor-pointer"
    >
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />
      <div className="text-[11px] text-[#8A80A8] font-semibold uppercase tracking-wider">
        {label}
      </div>
      <div className="text-xl font-bold text-[#403770] mt-1">{value}</div>
      <div className="text-[11px] text-[#A69DC0] mt-0.5">{subtitle}</div>
    </button>
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C4E7E6]/50" />
      <div className="h-3 w-16 bg-[#E2DEEC]/60 rounded animate-pulse mb-2" />
      <div className="h-5 w-20 bg-[#E2DEEC]/60 rounded animate-pulse" />
    </div>
  );
}

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

interface AdminKPICardsProps {
  stats: AdminStats | undefined;
  isLoading: boolean;
  onNavigateTab: (tab: "unmatched" | "users" | "integrations" | "sync") => void;
}

export default function AdminKPICards({ stats, isLoading, onNavigateTab }: AdminKPICardsProps) {
  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4">
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
        <KPICardSkeleton />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 gap-4">
      <KPICard
        accent="#F37167"
        label="Unmatched"
        value={stats.unmatched.total.toLocaleString()}
        subtitle={`${stats.unmatched.newThisWeek} new this week`}
        onClick={() => onNavigateTab("unmatched")}
      />
      <KPICard
        accent="#403770"
        label="Users"
        value={stats.users.total.toLocaleString()}
        subtitle={`${stats.users.activeToday} active today`}
        onClick={() => onNavigateTab("users")}
      />
      <KPICard
        accent="#6EA3BE"
        label="Integrations"
        value={stats.integrations.total.toLocaleString()}
        subtitle={stats.integrations.errors > 0 ? `${stats.integrations.errors} with errors` : "All connected"}
        onClick={() => onNavigateTab("integrations")}
      />
      <KPICard
        accent="#8AA891"
        label="Sync"
        value={stats.sync.status === "ok" ? "All OK" : `${stats.sync.recentErrors} errors`}
        subtitle={`Last sync ${relativeTime(stats.sync.lastSyncAt)}`}
        onClick={() => onNavigateTab("sync")}
      />
    </div>
  );
}
