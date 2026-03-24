"use client";

import { useState, useMemo, useEffect } from "react";
import {
  useProfile,
  useTerritoryPlans,
  useCreateTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";
import { getDefaultFiscalYear } from "@/features/goals/components/ProgressCard";
import PlanFormModal, {
  type PlanFormData,
} from "@/features/plans/components/PlanFormModal";
import { FYPlanGroup } from "./PlanCard";
import PlanDetailModal from "@/features/map/components/SearchResults/PlanDetailModal";
import { Clock, Plus } from "lucide-react";

// ============================================================================
// PlansTab
// ============================================================================

interface PlansTabProps {
  onBadgeCountChange?: (count: number) => void;
}

export default function PlansTab({ onBadgeCountChange }: PlansTabProps) {
  const { data: profile } = useProfile();
  const { data: plans } = useTerritoryPlans();
  const createPlan = useCreateTerritoryPlan();
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const currentFY = getDefaultFiscalYear();

  // Filter to user's own plans
  const myPlans = useMemo(
    () => (plans || []).filter((p) => p.owner?.id === profile?.id),
    [plans, profile?.id]
  );

  // Report badge count
  useEffect(() => {
    onBadgeCountChange?.(myPlans.length);
  }, [myPlans.length, onBadgeCountChange]);

  // Group by fiscal year, current first
  const fyGroups = useMemo(() => {
    const groups = new Map<number, TerritoryPlan[]>();
    for (const plan of myPlans) {
      const fy = plan.fiscalYear;
      if (!groups.has(fy)) groups.set(fy, []);
      groups.get(fy)!.push(plan);
    }

    // Sort: current FY first, then descending
    return Array.from(groups.entries()).sort((a, b) => {
      if (a[0] === currentFY) return -1;
      if (b[0] === currentFY) return 1;
      return b[0] - a[0];
    });
  }, [myPlans, currentFY]);

  const handleCreatePlan = async (data: PlanFormData) => {
    await createPlan.mutateAsync({
      name: data.name,
      description: data.description || undefined,
      ownerId: data.ownerId ?? undefined,
      color: data.color,
      status: data.status,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      stateFips: data.stateFips,
      collaboratorIds: data.collaboratorIds,
    });
    setShowPlanForm(false);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#403770]">My Territory Plans</h2>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#403770] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors">
            <Clock className="w-3.5 h-3.5" />
            Recently updated
          </button>
          <button
            onClick={() => setShowPlanForm(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#F37167] hover:bg-[#E0605A] rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Plan
          </button>
        </div>
      </div>

      {/* FY Groups */}
      <div className="space-y-8">
        {fyGroups.map(([fy, plans]) => (
          <FYPlanGroup
            key={fy}
            fiscalYear={fy}
            isCurrent={fy === currentFY}
            plans={plans}
            onCreatePlan={() => setShowPlanForm(true)}
            onNavigate={(id) => setSelectedPlanId(id)}
          />
        ))}

        {/* Empty state */}
        {fyGroups.length === 0 && (
          <div className="bg-white rounded-lg border border-[#D4CFE2] py-16 text-center">
            <p className="text-sm font-medium text-[#403770] mb-2">
              No territory plans yet
            </p>
            <p className="text-xs text-[#8A80A8] mb-4">
              Create your first plan to get started
            </p>
            <button
              onClick={() => setShowPlanForm(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#E0605A] rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Plan
            </button>
          </div>
        )}
      </div>

      {/* Plan creation modal */}
      <PlanFormModal
        isOpen={showPlanForm}
        onClose={() => setShowPlanForm(false)}
        onSubmit={handleCreatePlan}
        title="Create New Plan"
      />
      {selectedPlanId && (
        <PlanDetailModal
          planId={selectedPlanId}
          onClose={() => setSelectedPlanId(null)}
        />
      )}
    </div>
  );
}
