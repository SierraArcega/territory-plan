"use client";

import { useState } from "react";
import { useTerritoryPlan, useUpdateTerritoryPlan } from "@/lib/api";
import PlanFormModal, { type PlanFormData } from "@/components/plans/PlanFormModal";

interface PlanDashboardProps {
  planId: string;
  onBack: () => void;
}

export default function PlanDashboard({ planId, onBack }: PlanDashboardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const { data: plan, isLoading, error } = useTerritoryPlan(planId);
  const updatePlan = useUpdateTerritoryPlan();

  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-green-100", text: "text-green-700" },
    draft: { bg: "bg-yellow-100", text: "text-yellow-700" },
    archived: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  const handleEditPlan = async (data: PlanFormData) => {
    await updatePlan.mutateAsync({
      id: planId,
      name: data.name,
      description: data.description || undefined,
      ownerId: (data as unknown as { ownerId?: string }).ownerId,
      color: data.color,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading plan</p>
          <p className="text-sm mt-1">{error?.message || "Plan not found"}</p>
          <button onClick={onBack} className="mt-4 text-[#403770] hover:text-[#F37167]">
            ← Back to plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 px-4 py-2 text-sm text-[#403770] hover:text-[#F37167] bg-gray-50 border-b border-gray-100"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Plans
      </button>

      {/* Plan header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: plan.color }}
            />
            <div>
              <h2 className="font-semibold text-lg text-[#403770]">{plan.name}</h2>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                  statusColors[plan.status]?.bg || "bg-gray-100"
                } ${statusColors[plan.status]?.text || "text-gray-500"}`}
              >
                {plan.status}
              </span>
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
          >
            Edit
          </button>
        </div>
        {plan.description && (
          <p className="text-sm text-gray-600 mt-3">{plan.description}</p>
        )}
      </div>

      {/* Plan details */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500 block">Owner</span>
              <p className="font-medium text-gray-900">{plan.owner?.fullName || "\u2014"}</p>
            </div>
            <div>
              <span className="text-gray-500 block">Districts</span>
              <p className="font-medium text-gray-900">{plan.districts.length}</p>
            </div>
            {plan.startDate && (
              <div>
                <span className="text-gray-500 block">Start Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(plan.startDate.split("T")[0] + "T00:00:00").toLocaleDateString()}
                </p>
              </div>
            )}
            {plan.endDate && (
              <div>
                <span className="text-gray-500 block">End Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(plan.endDate.split("T")[0] + "T00:00:00").toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Districts list */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Districts ({plan.districts.length})
          </h3>
          {plan.districts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No districts in this plan</p>
          ) : (
            <div className="space-y-2">
              {plan.districts.map((district) => (
                <div
                  key={district.leaid}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{district.name}</p>
                    <p className="text-xs text-gray-500">
                      {district.stateAbbrev}
                      {district.enrollment && ` • ${district.enrollment.toLocaleString()} students`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <PlanFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditPlan}
        initialData={plan}
        title="Edit Plan"
      />
    </div>
  );
}
