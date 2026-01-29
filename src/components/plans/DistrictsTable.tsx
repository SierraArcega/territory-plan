"use client";

import { useState } from "react";
import Link from "next/link";
import type { TerritoryPlanDistrict } from "@/lib/api";

interface DistrictsTableProps {
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

export default function DistrictsTable({
  districts,
  onRemove,
  isRemoving,
}: DistrictsTableProps) {
  const [confirmRemove, setConfirmRemove] = useState<TerritoryPlanDistrict | null>(null);

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

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              District
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              State
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Enrollment
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Tags
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
              Added
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
              <td className="px-4 py-3">
                <span className="text-sm text-gray-600">
                  {formatEnrollment(district.enrollment)}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {district.tags && district.tags.length > 0 ? (
                    district.tags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full text-white"
                        style={{ backgroundColor: tag.color }}
                      >
                        {tag.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400 italic">No tags</span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-gray-500">
                  {formatDate(district.addedAt)}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/?leaid=${district.leaid}`}
                    className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                  >
                    View on Map
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
      </table>

      {/* Confirm Remove Dialog */}
      {confirmRemove && (
        <ConfirmRemoveDialog
          district={confirmRemove}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirmRemove(null)}
          isRemoving={isRemoving || false}
        />
      )}
    </div>
  );
}
