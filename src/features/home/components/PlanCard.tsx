"use client";

import { useState } from "react";
import type { TerritoryPlan } from "@/lib/api";
import { formatCurrency } from "@/features/shared/lib/format";
import { useMapStore } from "@/features/shared/lib/app-store";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import TaskFormModal from "@/features/tasks/components/TaskFormModal";
import PlanDetailModal from "@/features/map/components/SearchResults/PlanDetailModal";
import { Map, FileEdit, ListPlus, Plus } from "lucide-react";

// ============================================================================
// Status badge
// ============================================================================

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  working: { label: "Active", bg: "bg-[#F7FFF2]", text: "text-[#69B34A]" },
  planning: { label: "Planning", bg: "bg-[#E8F1F5]", text: "text-[#6EA3BE]" },
  archived: { label: "Closed", bg: "bg-[#FEF1F0]", text: "text-[#F37167]" },
  stale: { label: "Stale", bg: "bg-[#FFFAF1]", text: "text-[#D4A84B]" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.planning;
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.bg} ${config.text}`}>
      {config.label}
    </span>
  );
}

// ============================================================================
// Revenue metric
// ============================================================================

function RevenueStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-lg font-bold text-[#403770]">
        {formatCurrency(value, true)}
      </p>
      <p className="text-[11px] text-[#8A80A8]">{label}</p>
    </div>
  );
}

// ============================================================================
// Progress bar (revenue to target)
// ============================================================================

function RevenueProgress({ actual, target }: { actual: number; target: number }) {
  const pct = target > 0 ? Math.round((actual / target) * 100) : 0;
  const clampedWidth = Math.min(100, pct);

  const fillColor =
    pct >= 100 ? "#69B34A" :
    pct >= 75 ? "#6EA3BE" :
    pct >= 50 ? "#D4A84B" :
    "#F37167";

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[#8A80A8] font-medium">Revenue to target</span>
        <span className="text-xs font-medium" style={{ color: fillColor }}>
          {pct}%
        </span>
      </div>
      <div className="h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clampedWidth}%`, backgroundColor: fillColor }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Plan action buttons
// ============================================================================

function PlanActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Map;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="flex items-center gap-1 px-2 py-1.5 text-[11px] font-medium text-[#403770] bg-[#F7F5FA] rounded-lg hover:bg-[#EFEDF5] transition-colors"
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}

// ============================================================================
// TerritoryPlanCard
// ============================================================================

interface TerritoryPlanCardProps {
  plan: TerritoryPlan;
  onNavigate?: (planId: string) => void;
}

export function TerritoryPlanCard({ plan, onNavigate }: TerritoryPlanCardProps) {
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  const revenueTarget =
    plan.renewalRollup + plan.expansionRollup + plan.winbackRollup + plan.newBusinessRollup;
  const openPipeline = plan.pipelineTotal || 0;
  const closedWon = plan.revenueActual || 0;
  const revenue = plan.revenueActual || 0;

  const stateAbbrevs = plan.states?.map((s) => s.abbrev).join(", ") || "";

  return (
    <div
      onClick={() => setShowPlanDetail(true)}
      className="bg-white rounded-lg border border-[#D4CFE2] p-4 flex flex-col cursor-pointer hover:border-[#B8B0D0] hover:shadow-sm transition-all"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-[#403770]">{plan.name}</h3>
          <p className="text-xs text-[#8A80A8] mt-0.5">
            {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
            {stateAbbrevs && ` · ${stateAbbrevs}`}
          </p>
        </div>
        <StatusBadge status={plan.status} />
      </div>

      {/* Revenue metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <RevenueStat label="Rev. Target" value={revenueTarget} />
        <RevenueStat label="Open Pipeline" value={openPipeline} />
        <RevenueStat label="Closed Won" value={closedWon} />
        <RevenueStat label="Revenue" value={revenue} />
      </div>

      {/* Progress bar */}
      <RevenueProgress actual={revenue} target={revenueTarget} />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-[#E2DEEC]">
        <PlanActionButton
          icon={Map}
          label="View on Map"
          onClick={() => {
            const params = new URLSearchParams(window.location.search);
            params.set("tab", "map");
            params.set("plan", plan.id);
            window.history.pushState(null, "", `?${params.toString()}`);
            window.dispatchEvent(new PopStateEvent("popstate"));
          }}
        />
        <PlanActionButton icon={FileEdit} label="Log Activity" onClick={() => setShowActivityModal(true)} />
        <PlanActionButton icon={ListPlus} label="Create Task" onClick={() => setShowTaskModal(true)} />

      </div>

      <ActivityFormModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
        defaultPlanId={plan.id}
      />
      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        defaultPlanId={plan.id}
      />
      {showPlanDetail && (
        <PlanDetailModal
          planId={plan.id}
          onClose={() => setShowPlanDetail(false)}
        />
      )}
    </div>
  );
}

// ============================================================================
// CreatePlanCard
// ============================================================================

export function CreatePlanCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center min-h-[200px] rounded-lg border-2 border-dashed border-[#D4CFE2] text-[#8A80A8] hover:border-[#F37167] hover:text-[#F37167] transition-all"
    >
      <Plus className="w-8 h-8 mb-2" />
      <span className="text-sm font-medium">Create new plan</span>
    </button>
  );
}

// ============================================================================
// FYPlanGroup
// ============================================================================

interface FYPlanGroupProps {
  fiscalYear: number;
  isCurrent: boolean;
  plans: TerritoryPlan[];
  onCreatePlan: () => void;
  onNavigate?: (planId: string) => void;
}

export function FYPlanGroup({
  fiscalYear,
  isCurrent,
  plans,
  onCreatePlan,
  onNavigate,
}: FYPlanGroupProps) {
  return (
    <div>
      {/* FY header */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-bold text-[#403770]">
          FY{String(fiscalYear).slice(-2)}
        </span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isCurrent
              ? "bg-[#F7FFF2] text-[#69B34A]"
              : "bg-[#EFEDF5] text-[#8A80A8]"
          }`}
        >
          {isCurrent ? "Current" : "Completed"}
        </span>
        <span className="text-xs text-[#8A80A8]">
          {plans.length} plan{plans.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Plan cards grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {plans.map((plan) => (
          <TerritoryPlanCard key={plan.id} plan={plan} onNavigate={onNavigate} />
        ))}
        {isCurrent && <CreatePlanCard onClick={onCreatePlan} />}
      </div>
    </div>
  );
}
