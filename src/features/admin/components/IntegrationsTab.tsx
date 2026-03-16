"use client";

import { useAdminIntegrations, AdminIntegration } from "../hooks/useAdminIntegrations";

function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

type BadgeVariant = "connected" | "error" | "disconnected";

function getStatusVariant(status: string): BadgeVariant {
  const s = status.toLowerCase();
  if (s === "connected" || s === "healthy") return "connected";
  if (s === "error") return "error";
  return "disconnected";
}

const badgeStyles: Record<BadgeVariant, { bg: string; text: string; dot: string; label: string }> = {
  connected: {
    bg: "bg-[#EDFFE3]",
    text: "text-[#5f665b]",
    dot: "bg-[#5f665b]",
    label: "Connected",
  },
  error: {
    bg: "bg-[#F37167]/15",
    text: "text-[#c25a52]",
    dot: "bg-[#c25a52]",
    label: "Error",
  },
  disconnected: {
    bg: "bg-[#EFEDF5]",
    text: "text-[#8A80A8]",
    dot: "bg-[#8A80A8]",
    label: "Disconnected",
  },
};

function StatusBadge({ status }: { status: string }) {
  const variant = getStatusVariant(status);
  const style = badgeStyles[variant];
  // Use proper label: capitalize the raw status if it's a known keyword, otherwise show it
  const s = status.toLowerCase();
  let label = style.label;
  if (s === "healthy") label = "Healthy";
  if (s === "unknown") label = "Unknown";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${style.bg} ${style.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {label}
    </span>
  );
}

function IntegrationCard({ integration }: { integration: AdminIntegration }) {
  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5">
      {/* Top row */}
      <div className="flex items-center justify-between">
        <span className="text-base font-semibold text-[#403770]">
          {integration.name}
        </span>
        <StatusBadge status={integration.status} />
      </div>

      {/* Description */}
      <p className="text-sm text-[#8A80A8] mt-1">{integration.description}</p>

      {/* Bottom row */}
      <div className="mt-3 flex items-center gap-4">
        {integration.connectedUsers != null && integration.totalUsers != null && (
          <span className="text-xs text-[#A69DC0]">
            {integration.connectedUsers} of {integration.totalUsers} users connected
          </span>
        )}
        <span className="text-xs text-[#A69DC0]">
          Last sync: {relativeTime(integration.lastSyncAt)}
        </span>
      </div>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="animate-pulse rounded-xl bg-[#E2DEEC]/40 h-32" />
      <div className="animate-pulse rounded-xl bg-[#E2DEEC]/40 h-32" />
    </div>
  );
}

export default function IntegrationsTab() {
  const { data, isLoading } = useAdminIntegrations();

  if (isLoading) return <SkeletonCards />;

  const integrations = data?.integrations ?? [];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {integrations.map((integration) => (
        <IntegrationCard key={integration.slug} integration={integration} />
      ))}
    </div>
  );
}
