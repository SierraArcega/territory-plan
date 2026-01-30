"use client";

import { useState, useCallback, useEffect } from "react";
import { StateDetail, useUpdateState } from "@/lib/api";

interface StateHeaderProps {
  state: StateDetail;
}

export default function StateHeader({ state }: StateHeaderProps) {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [ownerValue, setOwnerValue] = useState(state.territoryOwner || "");
  const updateState = useUpdateState();
  const { aggregates } = state;

  // Sync with props when they change
  useEffect(() => {
    setOwnerValue(state.territoryOwner || "");
  }, [state.territoryOwner]);

  const handleSaveOwner = useCallback(() => {
    updateState.mutate(
      { stateCode: state.code, territoryOwner: ownerValue },
      { onSuccess: () => setIsEditingOwner(false) }
    );
  }, [updateState, state.code, ownerValue]);

  const handleCancelOwner = useCallback(() => {
    setOwnerValue(state.territoryOwner || "");
    setIsEditingOwner(false);
  }, [state.territoryOwner]);

  // Format large numbers
  const formatNumber = (n: number | null) => {
    if (n === null) return "N/A";
    return new Intl.NumberFormat("en-US").format(n);
  };

  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
      {/* State name and code */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#403770]">{state.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-500">{state.code}</span>
            <span className="text-gray-300">•</span>
            {isEditingOwner ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={ownerValue}
                  onChange={(e) => setOwnerValue(e.target.value)}
                  placeholder="Owner name"
                  className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#403770]"
                  autoFocus
                />
                <button
                  onClick={handleSaveOwner}
                  disabled={updateState.isPending}
                  className="px-2 py-1 text-xs font-medium text-white bg-[#403770] rounded hover:bg-[#403770]/90 disabled:opacity-50"
                >
                  {updateState.isPending ? "..." : "Save"}
                </button>
                <button
                  onClick={handleCancelOwner}
                  className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingOwner(true)}
                className="text-sm text-[#403770] font-medium hover:text-[#F37167] transition-colors"
              >
                {state.territoryOwner || (
                  <span className="text-gray-400 italic">Set owner</span>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#403770]">
            {formatNumber(aggregates.totalDistricts)}
          </div>
          <div className="text-xs text-gray-500">Districts</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#F37167]">
            {formatNumber(aggregates.totalCustomers)}
          </div>
          <div className="text-xs text-gray-500">Customers</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#6EA3BE]">
            {formatNumber(aggregates.totalWithPipeline)}
          </div>
          <div className="text-xs text-gray-500">Pipeline</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-gray-700">
            {aggregates.totalEnrollment
              ? `${(aggregates.totalEnrollment / 1000000).toFixed(1)}M`
              : "N/A"}
          </div>
          <div className="text-xs text-gray-500">Students</div>
        </div>
      </div>
    </div>
  );
}
