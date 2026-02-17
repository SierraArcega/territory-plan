"use client";

import { useState } from "react";
import { useTerritoryPlans, useCreateTerritoryPlan } from "@/lib/api";
import PlanDashboard from "../plans/PlanDashboard";
import PlanFormModal, { type PlanFormData } from "@/components/plans/PlanFormModal";

type PlanView = { type: "list" } | { type: "dashboard"; planId: string };

interface PlansTabContentProps {
  stateCode: string | null;
}

export default function PlansTabContent({ stateCode: _stateCode }: PlansTabContentProps) {
  const { data: plans, isLoading, error } = useTerritoryPlans();
  const [view, setView] = useState<PlanView>({ type: "list" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const createPlan = useCreateTerritoryPlan();

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
    // Modal closes automatically on submit success via PlanFormModal
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading plans</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  // If viewing a specific plan dashboard, render that
  if (view.type === "dashboard") {
    return <PlanDashboard planId={view.planId} onBack={() => setView({ type: "list" })} />;
  }

  if (!plans || plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <svg
          className="w-16 h-16 text-gray-200 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-gray-500 font-medium">No territory plans yet</p>
        <p className="text-gray-400 text-sm mt-1 mb-4">
          Create a plan to organize your target districts
        </p>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Plan
        </button>
        <PlanFormModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreatePlan}
          title="Create Territory Plan"
        />
      </div>
    );
  }

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    working: { bg: "bg-green-100", text: "text-green-700" },
    planning: { bg: "bg-yellow-100", text: "text-yellow-700" },
    stale: { bg: "bg-amber-100", text: "text-amber-700" },
    archived: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  // Filter to non-archived and sort by status (working first)
  const visiblePlans = plans
    .filter((p) => p.status !== "archived")
    .sort((a, b) => {
      if (a.status === "working" && b.status !== "working") return -1;
      if (b.status === "working" && a.status !== "working") return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">
          {visiblePlans.length} {visiblePlans.length === 1 ? "Plan" : "Plans"}
        </span>
      </div>

      {/* Plans list */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
        {visiblePlans.map((plan) => (
          <button
            key={plan.id}
            onClick={() => setView({ type: "dashboard", planId: plan.id })}
            className="block w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start gap-3">
              {/* Color indicator */}
              <div
                className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                style={{ backgroundColor: plan.color }}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-gray-900 truncate">
                    {plan.name}
                  </span>
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      statusColors[plan.status]?.bg || "bg-gray-100"
                    } ${statusColors[plan.status]?.text || "text-gray-500"}`}
                  >
                    {plan.status}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    {plan.districtCount} districts
                  </span>
                  {plan.owner?.fullName && (
                    <>
                      <span className="text-gray-300">|</span>
                      <span>{plan.owner.fullName}</span>
                    </>
                  )}
                </div>

                {plan.description && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                    {plan.description}
                  </p>
                )}
              </div>

              {/* Arrow icon */}
              <svg
                className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Create plan CTA */}
      <div className="px-4 py-3 border-t border-gray-100 bg-gray-50/50">
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Plan
        </button>
      </div>
      <PlanFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePlan}
        title="Create Territory Plan"
      />
    </div>
  );
}
