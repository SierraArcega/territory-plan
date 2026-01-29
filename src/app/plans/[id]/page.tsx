"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useTerritoryPlan,
  useUpdateTerritoryPlan,
  useDeleteTerritoryPlan,
  useRemoveDistrictFromPlan,
} from "@/lib/api";
import DistrictsTable from "@/components/plans/DistrictsTable";
import PlanFormModal, { type PlanFormData } from "@/components/plans/PlanFormModal";

function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "draft":
      return { label: "Draft", className: "bg-gray-200 text-gray-700" };
    case "active":
      return { label: "Active", className: "bg-[#8AA891] text-white" };
    case "archived":
      return { label: "Archived", className: "bg-gray-400 text-white" };
    default:
      return { label: status, className: "bg-gray-200 text-gray-700" };
  }
}

export default function PlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const planId = params.id as string;

  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: plan, isLoading, error } = useTerritoryPlan(planId);
  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();
  const removeDistrict = useRemoveDistrictFromPlan();

  const handleUpdatePlan = async (data: PlanFormData) => {
    await updatePlan.mutateAsync({
      id: planId,
      name: data.name,
      description: data.description || undefined,
      owner: data.owner || undefined,
      color: data.color,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
  };

  const handleDeletePlan = async () => {
    await deletePlan.mutateAsync(planId);
    router.push("/plans");
  };

  const handleRemoveDistrict = async (leaid: string) => {
    await removeDistrict.mutateAsync({ planId, leaid });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FFFCFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
          <p className="text-[#403770] font-medium">Loading plan...</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[#FFFCFA]">
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-6xl mx-auto">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-[#403770] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Plans
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center py-20">
          <div className="text-center text-red-500">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="font-medium mb-1">Plan not found</p>
            <p className="text-sm text-gray-500">{error?.message || "The requested plan could not be found."}</p>
          </div>
        </div>
      </div>
    );
  }

  const statusBadge = getStatusBadge(plan.status);
  const dateRange =
    plan.startDate || plan.endDate
      ? `${formatDate(plan.startDate)}${plan.startDate && plan.endDate ? " – " : ""}${formatDate(plan.endDate)}`
      : null;

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between">
            <Link
              href="/plans"
              className="inline-flex items-center gap-2 text-gray-500 hover:text-[#403770] transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Plans
            </Link>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowEditModal(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-500 border border-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Plan Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start gap-4">
            <span
              className="w-6 h-6 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: plan.color }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold text-[#403770]">{plan.name}</h1>
                <span className={`px-2.5 py-0.5 text-xs font-medium rounded-full ${statusBadge.className}`}>
                  {statusBadge.label}
                </span>
              </div>
              {plan.description && (
                <p className="text-gray-600 mb-3">{plan.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                <span>
                  {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
                </span>
                {plan.owner && (
                  <>
                    <span>•</span>
                    <span>Owner: <span className="text-[#403770] font-medium">{plan.owner}</span></span>
                  </>
                )}
                {dateRange && (
                  <>
                    <span>•</span>
                    <span>{dateRange}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Districts Table */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#403770]">
            Districts ({plan.districts.length})
          </h2>
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-[#403770] hover:text-[#F37167] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add from Map
          </Link>
        </div>
        <DistrictsTable
          districts={plan.districts}
          onRemove={handleRemoveDistrict}
          isRemoving={removeDistrict.isPending}
        />
      </main>

      {/* Edit Modal */}
      <PlanFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleUpdatePlan}
        initialData={plan}
        title="Edit Territory Plan"
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Plan?</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete &ldquo;{plan.name}&rdquo;? This will remove all district associations. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlan}
                disabled={deletePlan.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletePlan.isPending ? "Deleting..." : "Delete Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
