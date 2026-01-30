"use client";

import { useState } from "react";
import Link from "next/link";
import type { TerritoryPlanDistrict } from "@/lib/api";
import DistrictTargetEditor from "./DistrictTargetEditor";

interface DistrictsTableProps {
  planId: string;
  districts: TerritoryPlanDistrict[];
  onRemove: (leaid: string) => void;
  isRemoving?: boolean;
}

interface ConfirmRemoveDialogProps {
  district: TerritoryPlanDistrict;
  onConfirm: () => void;
  onCancel: () => void;
  isRemoving: boolean;
}

function ConfirmRemoveDialog({
  district,
  onConfirm,
  onCancel,
  isRemoving,
}: ConfirmRemoveDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-2">
          Remove District?
        </h3>
        <p className="text-gray-600 text-sm mb-6">
          Are you sure you want to remove &ldquo;{district.name}&rdquo; from this plan?
          This action cannot be undone.
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
            disabled={isRemoving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {isRemoving ? "Removing..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatEnrollment(enrollment: number | null): string {
  if (!enrollment) return "N/A";
  return enrollment.toLocaleString();
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "-";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function DistrictsTable({
  planId,
  districts,
  onRemove,
  isRemoving,
}: DistrictsTableProps) {
  const [confirmRemove, setConfirmRemove] = useState<TerritoryPlanDistrict | null>(null);
  const [editingDistrict, setEditingDistrict] = useState<TerritoryPlanDistrict | null>(null);

  const handleRemoveClick = (district: TerritoryPlanDistrict) => {
    setConfirmRemove(district);
  };

  const handleConfirmRemove = async () => {
    if (confirmRemove) {
      await onRemove(confirmRemove.leaid);
      setConfirmRemove(null);
    }
  };

  if (districts.length === 0) {
    return (
      <div className="text-center py-12">
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
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <h3 className="text-lg font-medium text-gray-600 mb-2">No districts yet</h3>
        <p className="text-sm text-gray-500 max-w-sm mx-auto">
          Add districts to this plan from the map view. Select a district and click &quot;Add to Plan&quot;.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
            />
          </svg>
          Go to Map
        </Link>
      </div>
    );
  }

  // Calculate totals
  const totals = districts.reduce(
    (acc, d) => ({
      revenueTarget: acc.revenueTarget + (d.revenueTarget || 0),
      pipelineTarget: acc.pipelineTarget + (d.pipelineTarget || 0),
      enrollment: acc.enrollment + (d.enrollment || 0),
    }),
    { revenueTarget: 0, pipelineTarget: 0, enrollment: 0 }
  );

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                District
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                State
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Revenue Target
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Pipeline Target
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Services
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {districts.map((district) => (
            <tr key={district.leaid} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-[#403770]">
                    {district.name}
                  </span>
                  <span className="text-xs text-gray-400 font-mono">
                    {district.leaid}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-600">
                  {district.stateAbbrev || "N/A"}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-600">
                  {formatCurrency(district.revenueTarget)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <span className="text-sm text-gray-600">
                  {formatCurrency(district.pipelineTarget)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {district.targetServices && district.targetServices.length > 0 ? (
                    district.targetServices.slice(0, 3).map((service) => (
                      <span
                        key={service.id}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: service.color }}
                        title={service.name}
                      >
                        {service.name.length > 12 ? `${service.name.slice(0, 12)}...` : service.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">-</span>
                  )}
                  {district.targetServices && district.targetServices.length > 3 && (
                    <span className="text-xs text-gray-400">
                      +{district.targetServices.length - 3}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingDistrict(district)}
                    className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                  >
                    Edit Targets
                  </button>
                  <Link
                    href={`/?leaid=${district.leaid}`}
                    className="text-sm text-gray-500 hover:text-[#403770] transition-colors"
                  >
                    Map
                  </Link>
                  <button
                    onClick={() => handleRemoveClick(district)}
                    disabled={isRemoving}
                    className="text-sm text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
        {/* Totals row */}
        <tfoot className="bg-gray-50 border-t border-gray-200">
          <tr>
            <td className="px-4 py-3">
              <span className="text-sm font-semibold text-gray-700">
                Total ({districts.length} districts)
              </span>
            </td>
            <td className="px-4 py-3"></td>
            <td className="px-4 py-3 text-right">
              <span className="text-sm font-semibold text-gray-700">
                {formatCurrency(totals.revenueTarget)}
              </span>
            </td>
            <td className="px-4 py-3 text-right">
              <span className="text-sm font-semibold text-gray-700">
                {formatCurrency(totals.pipelineTarget)}
              </span>
            </td>
            <td className="px-4 py-3"></td>
            <td className="px-4 py-3"></td>
          </tr>
        </tfoot>
        </table>
      </div>

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <ConfirmRemoveDialog
          district={confirmRemove}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemove(null)}
          isRemoving={isRemoving || false}
        />
      )}

      {/* District Target Editor */}
      {editingDistrict && (
        <DistrictTargetEditor
          isOpen={!!editingDistrict}
          onClose={() => setEditingDistrict(null)}
          planId={planId}
          district={editingDistrict}
        />
      )}
    </div>
  );
}
