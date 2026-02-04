"use client";

// PlansTable - Table view for territory plans with inline editing.
// Displays all plans in a tabular format with columns for color, name,
// description, owner, FY, status, dates, districts, and actions.

import { useState } from "react";
import {
  useUpdateTerritoryPlan,
  useDeleteTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";
import InlineEditCell from "@/components/common/InlineEditCell";

interface PlansTableProps {
  plans: TerritoryPlan[];
  onSelectPlan: (planId: string) => void;
}

// Status options for the dropdown
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// Status badge styling
function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-[#8AA891] text-white";
    case "draft":
      return "bg-gray-200 text-gray-700";
    case "archived":
      return "bg-gray-400 text-white";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

// Format status label for display
function formatStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

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
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Plan?</h3>
        <p className="text-gray-600 text-sm mb-6">
          Are you sure you want to delete &ldquo;{plan.name}&rdquo;? This will remove all
          district associations. This action cannot be undone.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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

export default function PlansTable({ plans, onSelectPlan }: PlansTableProps) {
  const [planToDelete, setPlanToDelete] = useState<TerritoryPlan | null>(null);

  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();

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
      await deletePlan.mutateAsync(planToDelete.id);
      setPlanToDelete(null);
    }
  };

  // Empty state
  if (plans.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
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
        <h3 className="text-lg font-medium text-gray-600 mb-2">No plans yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Create your first territory plan to get started.
        </p>
      </div>
    );
  }

  // Calculate total district count
  const totalDistrictCount = plans.reduce((sum, plan) => sum + plan.districtCount, 0);

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className="w-[40px] px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider"
                aria-label="Color"
              >
                {/* Color dot column */}
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Name
              </th>
              <th className="w-[200px] max-w-[200px] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Description
              </th>
              <th className="w-[120px] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Owner
              </th>
              <th className="w-[60px] px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                FY
              </th>
              <th className="w-[100px] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="w-[160px] px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Dates
              </th>
              <th className="w-[80px] px-3 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Districts
              </th>
              <th className="w-[60px] px-3 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {plans.map((plan) => (
              <tr
                key={plan.id}
                className="hover:bg-gray-50 transition-colors"
              >
                {/* Color dot */}
                <td className="px-3 py-3">
                  <span
                    className="w-4 h-4 rounded-full block"
                    style={{ backgroundColor: plan.color }}
                  />
                </td>

                {/* Name (editable) */}
                <td className="px-4 py-2">
                  <InlineEditCell
                    type="text"
                    value={plan.name}
                    onSave={async (value) => handleFieldUpdate(plan.id, "name", value)}
                    className="font-medium text-[#403770]"
                  />
                </td>

                {/* Description (editable, truncated) */}
                <td className="px-4 py-2 max-w-[200px]">
                  <InlineEditCell
                    type="textarea"
                    value={plan.description}
                    onSave={async (value) => handleFieldUpdate(plan.id, "description", value)}
                    placeholder="Add description..."
                    className="text-sm text-gray-600 truncate"
                  />
                </td>

                {/* Owner (editable) */}
                <td className="px-4 py-2">
                  <InlineEditCell
                    type="text"
                    value={plan.owner}
                    onSave={async (value) => handleFieldUpdate(plan.id, "owner", value)}
                    placeholder="Assign owner..."
                    className="text-sm text-gray-600"
                  />
                </td>

                {/* FY Badge (display only) */}
                <td className="px-3 py-3 text-center">
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white">
                    FY{String(plan.fiscalYear).slice(-2)}
                  </span>
                </td>

                {/* Status (editable select) */}
                <td className="px-4 py-2">
                  <InlineEditCell
                    type="select"
                    value={plan.status}
                    onSave={async (value) => handleFieldUpdate(plan.id, "status", value)}
                    options={STATUS_OPTIONS}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full inline-block ${getStatusBadgeClass(plan.status)}`}
                  />
                </td>

                {/* Dates (editable date pickers) */}
                <td className="px-4 py-2">
                  <div className="flex items-center gap-1 text-sm text-gray-600">
                    <InlineEditCell
                      type="date"
                      value={plan.startDate}
                      onSave={async (value) => handleFieldUpdate(plan.id, "startDate", value)}
                      placeholder="Start"
                      className="text-xs"
                    />
                    <span className="text-gray-400">-</span>
                    <InlineEditCell
                      type="date"
                      value={plan.endDate}
                      onSave={async (value) => handleFieldUpdate(plan.id, "endDate", value)}
                      placeholder="End"
                      className="text-xs"
                    />
                  </div>
                </td>

                {/* Districts (clickable to navigate) */}
                <td className="px-3 py-3 text-center">
                  <button
                    onClick={() => onSelectPlan(plan.id)}
                    className="text-sm font-medium text-[#403770] hover:text-[#F37167] transition-colors"
                  >
                    {plan.districtCount}
                  </button>
                </td>

                {/* Actions */}
                <td className="px-3 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSelectPlan(plan.id)}
                      className="text-xs text-[#403770] hover:text-[#F37167] transition-colors"
                      aria-label="View plan"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setPlanToDelete(plan)}
                      className="text-xs text-red-500 hover:text-red-700 transition-colors"
                      aria-label="Delete plan"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200" aria-label="footer">
            <tr>
              <td className="px-3 py-3"></td>
              <td className="px-4 py-3" colSpan={6}>
                <span className="text-sm font-semibold text-gray-700">
                  Total ({plans.length} plans)
                </span>
              </td>
              <td className="px-3 py-3 text-center">
                <span className="text-sm font-semibold text-gray-700">
                  {totalDistrictCount}
                </span>
              </td>
              <td className="px-3 py-3"></td>
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
  );
}
