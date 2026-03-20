"use client";

// PlansTable - Table view for territory plans with inline editing.
// Displays all plans in a tabular format with columns for color, name,
// description, owner, FY, status, dates, districts, and actions.

import { useState } from "react";
import { Map, Trash2 } from "lucide-react";
import {
  useUpdateTerritoryPlan,
  useDeleteTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";
import InlineEditCell from "@/features/shared/components/InlineEditCell";
import { useSortableTable, type SortComparator } from "@/features/shared/hooks/useSortableTable";
import { SortHeader } from "@/features/shared/components/SortHeader";

interface PlansTableProps {
  plans: TerritoryPlan[];
  onSelectPlan: (planId: string) => void;
  onEditPlan?: (plan: TerritoryPlan) => void;
  onShowOnMap?: (planId: string) => void;
  toolbar?: React.ReactNode;
}

// Status options for the dropdown
const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

// Status badge styling
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "working":
      return "bg-[#8AA891] text-white";
    case "planning":
      return "bg-[#EFEDF5] text-[#6E6390]";
    case "stale":
      return "bg-amber-200 text-amber-800";
    case "archived":
      return "bg-[#A69DC0] text-white";
    default:
      return "bg-[#EFEDF5] text-[#6E6390]";
  }
}

// Format status label for display
function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Sort order for plan statuses — used by the custom status comparator
const PLAN_STATUS_ORDER: Record<string, number> = {
  planning: 0,
  working: 1,
  stale: 2,
  archived: 3,
};

// Custom comparators for columns that can't be sorted lexicographically.
// Defined at module level (not inline) so useMemo's dependency stays stable.
const planComparators: Record<string, SortComparator<TerritoryPlan>> = {
  owner: (a, b, dir) => {
    const aName = a.owner?.fullName ?? null;
    const bName = b.owner?.fullName ?? null;
    if (!aName && !bName) return 0;
    if (!aName) return 1; // null-last is direction-independent by design — nulls always appear at the end
    if (!bName) return -1;
    const r = aName.localeCompare(bName);
    return dir === "desc" ? -r : r;
  },
  status: (a, b, dir) => {
    const r = (PLAN_STATUS_ORDER[a.status] ?? 9) - (PLAN_STATUS_ORDER[b.status] ?? 9);
    return dir === "desc" ? -r : r;
  },
};

// Delete confirmation modal
interface DeleteConfirmModalProps {
  plan: TerritoryPlan;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  plan,
  onConfirm,
  onCancel,
  isDeleting,
}: DeleteConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Plan?</h3>
        <p className="text-[#6E6390] text-sm mb-6">
          Are you sure you want to delete &ldquo;{plan.name}&rdquo;? This will remove all
          district associations. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PlansTable({ plans, onSelectPlan, onEditPlan, onShowOnMap, toolbar }: PlansTableProps) {
  const [planToDelete, setPlanToDelete] = useState<TerritoryPlan | null>(null);

  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();

  const { sorted: sortedPlans, sortState, onSort } = useSortableTable({
    data: plans,
    comparators: planComparators,
  });

  // Handle inline field updates
  const handleFieldUpdate = async (
    planId: string,
    field: string,
    value: string
  ) => {
    await updatePlan.mutateAsync({
      id: planId,
      [field]: value,
    });
  };

  // Handle delete confirmation
  const handleDeleteConfirm = async () => {
    if (planToDelete) {
      try {
        await deletePlan.mutateAsync(planToDelete.id);
        setPlanToDelete(null);
      } catch (error) {
        console.error("PlansTable delete failed:", error);
        // Keep modal open so user can retry
      }
    }
  };

  // Empty state
  if (plans.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-[#D4CFE2]">
        <svg
          className="w-16 h-16 mx-auto text-[#C2BBD4] mb-4"
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
        <h3 className="text-lg font-medium text-[#6E6390] mb-2">No plans yet</h3>
        <p className="text-sm text-[#8A80A8] max-w-sm mx-auto">
          Create your first territory plan to get started.
        </p>
      </div>
    );
  }

  // Calculate total district count
  const totalDistrictCount = plans.reduce((sum, plan) => sum + plan.districtCount, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {toolbar && (
        <div className="px-4 py-2.5 border-b border-[#E2DEEC] bg-[#F7F5FA] relative z-20 rounded-t-lg border-x border-t border-[#D4CFE2]">
          {toolbar}
        </div>
      )}
      <div className={`overflow-hidden border border-[#D4CFE2] ${toolbar ? 'rounded-b-lg border-t-0' : 'rounded-lg'} bg-white shadow-sm flex flex-col flex-1 min-h-0`}>
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full table-fixed divide-y divide-[#D4CFE2]">
          <thead className="bg-[#F7F5FA] sticky top-0 z-10">
            <tr>
              <th
                className="w-[28px] px-2 py-2 text-left text-xs font-semibold text-[#8A80A8] uppercase tracking-wider bg-[#F7F5FA]"
                aria-label="Color"
              >
                {/* Color dot column */}
              </th>
              <SortHeader
                field="name"
                label="Name"
                sortState={sortState}
                onSort={onSort}
                className="w-[18%]"
              />
              <th className="w-[22%] px-2 py-2 text-left text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">
                Description
              </th>
              <SortHeader
                field="owner"
                label="Owner"
                sortState={sortState}
                onSort={onSort}
                className="w-[12%]"
              />
              <th className="w-[8%] px-2 py-2 text-left text-xs font-semibold text-[#8A80A8] uppercase tracking-wider bg-[#F7F5FA]">
                State
              </th>
              <SortHeader
                field="fiscalYear"
                label="FY"
                sortState={sortState}
                onSort={onSort}
                className="w-[40px] px-1 text-center"
              />
              <SortHeader
                field="status"
                label="Status"
                sortState={sortState}
                onSort={onSort}
                className="w-[10%]"
              />
              <SortHeader
                field="districtCount"
                label="Dist."
                sortState={sortState}
                onSort={onSort}
                className="w-[44px] text-center"
              />
              <th className="w-[56px] px-2 py-2 text-right text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[#E2DEEC]">
            {sortedPlans.map((plan) => (
              <tr
                key={plan.id}
                className="hover:bg-[#EFEDF5] transition-colors"
              >
                {/* Color dot */}
                <td className="px-2 py-1.5">
                  <span
                    className="w-3 h-3 rounded-full block"
                    style={{ backgroundColor: plan.color }}
                    aria-label={`Plan color indicator`}
                    role="presentation"
                  />
                </td>

                {/* Name (click to navigate) */}
                <td className="px-2 py-1 truncate">
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className="text-sm font-medium text-[#403770] hover:underline truncate text-left cursor-pointer"
                  >
                    {plan.name}
                  </button>
                </td>

                {/* Description (editable, truncated) */}
                <td className="px-2 py-1 truncate">
                  <InlineEditCell
                    type="textarea"
                    value={plan.description}
                    onSave={async (value) => handleFieldUpdate(plan.id, "description", value)}
                    placeholder="Add description..."
                    className="text-xs text-[#8A80A8] truncate"
                  />
                </td>

                {/* Owner */}
                <td className="px-2 py-1 cursor-pointer">
                  <span className="text-xs text-[#8A80A8]">
                    {plan.owner?.fullName ?? "\u2014"}
                  </span>
                </td>

                {/* State abbreviations */}
                <td className="px-2 py-1 truncate">
                  <span className="text-xs text-[#6E6390]">
                    {plan.states.map((s) => s.abbrev).join(", ") || "\u2014"}
                  </span>
                </td>

                {/* FY Badge (display only) */}
                <td className="px-1 py-1.5 text-center">
                  <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-[#403770] text-white">
                    FY{String(plan.fiscalYear).slice(-2)}
                  </span>
                </td>

                {/* Status (editable select) */}
                <td className="px-2 py-1">
                  <InlineEditCell
                    type="select"
                    value={plan.status}
                    onSave={async (value) => handleFieldUpdate(plan.id, "status", value)}
                    options={STATUS_OPTIONS}
                    className={`text-xs font-medium px-1.5 py-0.5 rounded-full inline-block ${getStatusBadgeClass(plan.status)}`}
                  />
                </td>

                {/* Districts (clickable to navigate) */}
                <td className="px-2 py-1.5 text-center">
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className="text-xs font-medium text-[#403770] hover:text-[#F37167] transition-colors cursor-pointer"
                  >
                    {plan.districtCount}
                  </button>
                </td>

                {/* Actions */}
                <td className="px-2 py-1.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {onShowOnMap && (
                      <button
                        onClick={() => onShowOnMap(plan.id)}
                        className={`transition-colors ${
                          plan.districtCount === 0
                            ? "text-[#D4CFE2] cursor-not-allowed"
                            : "text-[#8A80A8] hover:text-[#403770] cursor-pointer"
                        }`}
                        disabled={plan.districtCount === 0}
                        aria-label="Show plan on map"
                        title={plan.districtCount === 0 ? "No districts to show" : "Show on map"}
                      >
                        <Map className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setPlanToDelete(plan)}
                      className="text-[#8A80A8] hover:text-[#F37167] transition-colors cursor-pointer"
                      aria-label="Delete plan"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-[#F7F5FA] border-t border-[#E2DEEC]" aria-label="footer">
            <tr>
              <td className="px-2 py-2"></td>
              <td className="px-2 py-2" colSpan={6}>
                <span className="text-xs font-semibold text-[#6E6390]">
                  Total ({plans.length} plans)
                </span>
              </td>
              <td className="px-2 py-2 text-center">
                <span className="text-xs font-semibold text-[#6E6390]">
                  {totalDistrictCount}
                </span>
              </td>
              <td className="px-2 py-2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {planToDelete && (
        <DeleteConfirmModal
          plan={planToDelete}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setPlanToDelete(null)}
          isDeleting={deletePlan.isPending}
        />
      )}
      </div>
    </div>
  );
}
