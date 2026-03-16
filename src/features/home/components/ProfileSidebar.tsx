"use client";

import { useState, useRef, useEffect } from "react";
import { useProfile } from "@/lib/api";
import { useCalendarConnection } from "@/features/calendar/lib/queries";
import { useGoalDashboard } from "@/features/goals/lib/queries";
import { getDefaultFiscalYear } from "@/features/goals/components/ProgressCard";
import PlanFormModal, { type PlanFormData } from "@/features/plans/components/PlanFormModal";
import { useCreateTerritoryPlan } from "@/lib/api";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import TaskFormModal from "@/features/tasks/components/TaskFormModal";
import {
  Calendar,
  Clock,
  Mail,
  Zap,
  MessageSquare,
  CircleDollarSign,
  Phone,
  MapPin,
  Check,
  Map,
  FileEdit,
  ListPlus,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";

// ============================================================================
// Static integration data
// ============================================================================

interface Integration {
  name: string;
  icon: LucideIcon;
  status: "connected" | "setup";
}

const INTEGRATIONS: Integration[] = [
  { name: "Calendar", icon: Calendar, status: "connected" },
  { name: "Gmail", icon: Mail, status: "setup" },
  { name: "Mixmax", icon: Zap, status: "setup" },
  { name: "Slack", icon: MessageSquare, status: "connected" },
  { name: "Rippling", icon: CircleDollarSign, status: "setup" },
];

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

// ============================================================================
// ProfileSidebar
// ============================================================================

export default function ProfileSidebar() {
  const { data: profile, isLoading } = useProfile();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const createPlan = useCreateTerritoryPlan();

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
    <aside className="w-[289px] shrink-0 border-r border-[#E2DEEC] bg-white h-full overflow-y-auto">
      <div className="px-6 pt-8">
        {/* ---- User Avatar + Info ---- */}
        <div className="flex flex-col items-center mb-6">
          {isLoading ? (
            <div className="w-[88px] h-[88px] rounded-full bg-[#EFEDF5] animate-pulse" />
          ) : profile?.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={displayName}
              className="w-[88px] h-[88px] rounded-full object-cover shadow-sm"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center bg-coral shadow-sm">
              <span className="text-2xl font-bold text-white">{initials}</span>
            </div>
          )}
          <h2 className="mt-4 text-xl font-bold text-plum text-center">
            {isLoading ? (
              <span className="inline-block w-32 h-5 bg-[#EFEDF5] rounded-lg animate-pulse" />
            ) : (
              displayName
            )}
          </h2>
          {jobTitle && (
            <p className="mt-1 text-sm font-medium text-[#8A80A8] text-center">
              {jobTitle}
            </p>
          )}

          {/* ---- Quick Actions ---- */}
          <div className="mt-4 self-stretch">
            <div className="grid grid-cols-2 gap-2">
              <QuickActionButton icon={Map} label="Create Plan" onClick={() => setShowPlanModal(true)} />
              <QuickActionButton icon={FileEdit} label="Log Activity" onClick={() => setShowActivityModal(true)} />
              <QuickActionButton icon={ListPlus} label="Create Task" onClick={() => setShowTaskModal(true)} />
              <QuickActionButton
                icon={ExternalLink}
                label="Create Opp"
                onClick={() => window.open("https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26", "_blank")}
              />
            </div>
          </div>
        </div>

        {/* ---- Fiscal Year Summary ---- */}
        <FiscalYearSummary />

        {/* ---- Divider ---- */}
        <div className="h-px bg-[#E2DEEC]" />

        {/* ---- Integrations ---- */}
        <div className="mt-6">
          <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
            Integrations
          </p>
          <div className="mt-3 flex items-center gap-2.5">
            {INTEGRATIONS.map((integration, i) => (
              <IntegrationChip key={integration.name} integration={integration} alignRight={i >= 2} />
            ))}
          </div>
        </div>

        {/* ---- Divider ---- */}
        <div className="h-px bg-[#E2DEEC] mt-6" />

        {/* ---- Contact Details ---- */}
        {!isLoading && (profile?.email || profile?.phone || profile?.location) && (
          <div className="mt-6 pb-8 flex flex-col gap-1.5 text-[#A69DC0]">
            {profile?.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium text-[#8A80A8]">{profile.email}</span>
              </div>
            )}
            {profile?.phone && (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium text-[#8A80A8]">{profile.phone}</span>
              </div>
            )}
            {profile?.location && (
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium text-[#8A80A8]">{profile.location}</span>
              </div>
            )}
            {profile?.lastLoginAt && (
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span className="text-xs font-medium text-[#8A80A8]">{relativeTime(profile.lastLoginAt)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <PlanFormModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSubmit={async (data: PlanFormData) => {
          await createPlan.mutateAsync(data);
          setShowPlanModal(false);
        }}
      />
      <ActivityFormModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />
      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
      />
    </aside>
  );
}

// ============================================================================
// QuickActionButton
// ============================================================================

function QuickActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Map;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#544A78] bg-[#F7F5FA] rounded-lg hover:bg-[#EFEDF5] transition-colors cursor-pointer"
    >
      <Icon className="w-3.5 h-3.5 text-[#8A80A8]" />
      {label}
    </button>
  );
}

// ============================================================================
// FiscalYearSummary
// ============================================================================

const FISCAL_YEARS = [2025, 2026, 2027];

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function FiscalYearSummary() {
  const defaultFY = getDefaultFiscalYear();
  const [selectedFY, setSelectedFY] = useState(defaultFY);
  const { data, isLoading } = useGoalDashboard(selectedFY);

  const rank = data?.leaderboard?.rank ?? 0;
  const totalReps = data?.leaderboard?.totalReps ?? 0;

  const rows = [
    { label: "Targeted", value: data?.planTotals?.totalTarget ?? 0 },
    { label: "Pipeline", value: data?.actuals?.pipeline ?? 0 },
    { label: "Revenue", value: data?.actuals?.revenue ?? 0 },
    { label: "Take", value: data?.actuals?.take ?? 0 },
  ];

  return (
    <div className="mb-6 mt-2">
      {/* FY Tabs */}
      <div className="flex gap-4 mb-3 border-b border-[#E2DEEC]">
        {FISCAL_YEARS.map((fy) => (
          <button
            key={fy}
            onClick={() => setSelectedFY(fy)}
            className={`pb-1.5 text-[11px] font-semibold cursor-pointer transition-colors ${
              selectedFY === fy
                ? "text-plum border-b-2 border-plum"
                : "text-[#8A80A8] hover:text-plum"
            }`}
          >
            FY{fy.toString().slice(-2)}
          </button>
        ))}
      </div>

      {/* Leaderboard Rank */}
      {!isLoading && rank > 0 && (
        <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 rounded-lg bg-[#F7F5FA]">
          <span className="text-base font-bold text-plum">#{rank}</span>
          <span className="text-[11px] font-medium text-[#8A80A8]">of {totalReps} reps by take</span>
        </div>
      )}

      {/* Summary Rows */}
      <div className="flex flex-col gap-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-[#8A80A8]">{row.label}</span>
            {isLoading ? (
              <span className="inline-block w-14 h-3.5 bg-[#EFEDF5] rounded animate-pulse" />
            ) : (
              <span className="text-[13px] font-semibold text-plum">{fmt(row.value)}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// IntegrationChip
// ============================================================================

function IntegrationChip({ integration, alignRight = false }: { integration: Integration; alignRight?: boolean }) {
  const Icon = integration.icon;
  const isConnected = integration.status === "connected";
  const label = isConnected ? integration.name : `Connect ${integration.name}`;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const tooltip = (
    <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-lg bg-plum text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none">
      {label}
    </span>
  );

  if (isConnected) {
    return (
      <div className="relative group" ref={ref}>
        <button
          className="cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <div className="w-7 h-7 rounded-full flex items-center justify-center ring-[1.5px] ring-[#69B34A] bg-[#F7FFF2] text-[#544A78]">
            <Icon className="w-3.5 h-3.5" />
          </div>
        </button>
        {!open && tooltip}
        {open && integration.name === "Calendar" && <CalendarPopover onClose={() => setOpen(false)} alignRight={alignRight} />}
        {open && integration.name === "Slack" && (
          <IntegrationPopover name="Slack" status="Connected" onClose={() => setOpen(false)} alignRight={alignRight} />
        )}
      </div>
    );
  }

  return (
    <button
      className="relative group cursor-pointer"
      onClick={() => {/* TODO: open integration setup */}}
    >
      <div className="w-7 h-7 rounded-full flex items-center justify-center ring-[1.5px] ring-[#E2DEEC] bg-[#F7F5FA] text-[#8A80A8] opacity-50 group-hover:opacity-100 group-hover:ring-coral transition-all duration-100">
        <Icon className="w-3.5 h-3.5" />
      </div>
      {tooltip}
    </button>
  );
}

// ============================================================================
// CalendarPopover — shows connection details for Google Calendar
// ============================================================================

function CalendarPopover({ onClose, alignRight = false }: { onClose: () => void; alignRight?: boolean }) {
  const { data, isLoading } = useCalendarConnection();

  return (
    <div className={`absolute top-12 w-[240px] bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg p-4 z-30 ${alignRight ? "right-0" : "left-0"}`}>
      <p className="text-xs font-semibold text-[#544A78]">Google Calendar</p>
      {isLoading ? (
        <div className="mt-2 h-3 w-32 bg-[#EFEDF5] rounded-lg animate-pulse" />
      ) : data?.connected ? (
        <div className="mt-2 flex flex-col gap-1.5 text-[#A69DC0]">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-[#69B34A]" />
            <span className="text-xs font-medium text-[#69B34A]">Connected</span>
          </div>
          <p className="text-xs font-medium text-[#8A80A8]">
            {data.connection?.googleAccountEmail}
          </p>
          {data.connection?.lastSyncAt && (
            <p className="text-[10px] font-medium text-[#A69DC0]">
              Last sync: {relativeTime(data.connection.lastSyncAt)}
            </p>
          )}
          {typeof data.pendingCount === "number" && data.pendingCount > 0 && (
            <p className="text-[10px] font-medium text-coral">
              {data.pendingCount} event{data.pendingCount !== 1 ? "s" : ""} pending review
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-xs font-medium text-[#8A80A8]">Not connected</p>
      )}
    </div>
  );
}

// ============================================================================
// IntegrationPopover — generic status popover for other integrations
// ============================================================================

function IntegrationPopover({ name, status, onClose, alignRight = false }: { name: string; status: string; onClose: () => void; alignRight?: boolean }) {
  return (
    <div className={`absolute top-12 w-[200px] bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg p-4 z-30 ${alignRight ? "right-0" : "left-0"}`}>
      <p className="text-xs font-semibold text-[#544A78]">{name}</p>
      <div className="mt-2 flex items-center gap-1.5">
        <Check className="w-3.5 h-3.5 text-[#69B34A]" />
        <span className="text-xs font-medium text-[#69B34A]">{status}</span>
      </div>
    </div>
  );
}
