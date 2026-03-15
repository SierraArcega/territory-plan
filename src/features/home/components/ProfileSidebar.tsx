"use client";

import { useProfile } from "@/lib/api";
import {
  Calendar,
  Mail,
  Zap,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Static integration data
// ============================================================================

interface Integration {
  name: string;
  icon: LucideIcon;
  status: "connected" | "setup";
  bgColor: string;
}

const INTEGRATIONS: Integration[] = [
  { name: "Calendar", icon: Calendar, status: "connected", bgColor: "#E8F1F5" },
  { name: "Gmail", icon: Mail, status: "setup", bgColor: "#FEF1F0" },
  { name: "Mixmax", icon: Zap, status: "setup", bgColor: "#F7F5FA" },
  { name: "Slack", icon: MessageSquare, status: "connected", bgColor: "#F7FFF2" },
  { name: "Rippling", icon: Users, status: "setup", bgColor: "#FFFAF1" },
];

// ============================================================================
// ProfileSidebar
// ============================================================================

export default function ProfileSidebar() {
  const { data: profile, isLoading } = useProfile();

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || "??";

  const displayName = profile?.fullName || "Set up your profile";
  const jobTitle = profile?.jobTitle || "";

  return (
    <aside className="w-[340px] shrink-0 border-r border-[#E2DEEC] bg-white h-full overflow-y-auto">
      <div className="px-6 pt-8">
        {/* ---- User Avatar + Info ---- */}
        <div className="flex flex-col items-center mb-6">
          {isLoading ? (
            <div className="w-[88px] h-[88px] rounded-full bg-[#EFEDF5] animate-pulse" />
          ) : (
            <div
              className="w-[88px] h-[88px] rounded-full flex items-center justify-center shadow-[0px_4px_12px_rgba(243,113,103,0.25)]"
              style={{
                background: "linear-gradient(135deg, #F37167 0%, #E0605A 100%)",
              }}
            >
              <span className="text-[28px] font-bold text-white">{initials}</span>
            </div>
          )}
          <h2 className="mt-4 text-xl font-bold text-[#403770] text-center">
            {isLoading ? (
              <span className="inline-block w-32 h-5 bg-[#EFEDF5] rounded animate-pulse" />
            ) : (
              displayName
            )}
          </h2>
          {jobTitle && (
            <p className="mt-1 text-sm font-medium text-[#8A80A8] text-center">
              {jobTitle}
            </p>
          )}
        </div>

        {/* ---- Divider ---- */}
        <div className="h-px bg-[#E2DEEC]" />

        {/* ---- Integrations ---- */}
        <div className="mt-6">
          <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-[0.88px]">
            Integrations
          </p>
          <div className="mt-4 flex flex-col gap-1.5">
            {INTEGRATIONS.map((integration) => (
              <IntegrationRow key={integration.name} integration={integration} />
            ))}
          </div>
        </div>

        {/* ---- Divider ---- */}
        <div className="mt-6 h-px bg-[#E2DEEC]" />

        {/* ---- Profile Setup ---- */}
        <div className="mt-6 pb-8">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-[#544A78]">
              Profile Setup
            </span>
            <span className="text-[13px] font-bold text-[#F37167]">40%</span>
          </div>
          <div className="mt-2 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: "40%",
                background: "linear-gradient(90deg, #F37167 0%, #E0605A 100%)",
              }}
            />
          </div>
          <p className="mt-2 text-xs text-[#A69DC0]">
            Connect your tools to get started
          </p>
        </div>
      </div>
    </aside>
  );
}

// ============================================================================
// IntegrationRow
// ============================================================================

function IntegrationRow({ integration }: { integration: Integration }) {
  const Icon = integration.icon;
  const isConnected = integration.status === "connected";

  return (
    <div className="flex items-center gap-3 px-3 py-3 rounded-lg">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: integration.bgColor }}
      >
        <Icon className="w-[18px] h-[18px] text-[#544A78]" />
      </div>
      <span className="flex-1 text-sm font-medium text-[#544A78]">
        {integration.name}
      </span>
      <span
        className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
          isConnected
            ? "bg-[#F7FFF2] text-[#69B34A]"
            : "bg-[#FEF1F0] text-[#F37167]"
        }`}
      >
        {isConnected ? "Connected" : "Set up"}
      </span>
    </div>
  );
}
