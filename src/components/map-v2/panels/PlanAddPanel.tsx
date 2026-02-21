"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import { useAddDistrictsToPlan } from "@/lib/api";

export default function PlanAddPanel() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const planDistrictLeaids = useMapV2Store((s) => s.planDistrictLeaids);
  const removeDistrictFromPlan = useMapV2Store((s) => s.removeDistrictFromPlan);
  const finishAddingDistricts = useMapV2Store((s) => s.finishAddingDistricts);

  const addMutation = useAddDistrictsToPlan();

  const handleDone = async () => {
    if (!activePlanId || planDistrictLeaids.size === 0) {
      finishAddingDistricts();
      return;
    }

    try {
      await addMutation.mutateAsync({
        planId: activePlanId,
        leaids: Array.from(planDistrictLeaids),
      });
      finishAddingDistricts();
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-gray-100">
        <div className="text-sm font-medium text-gray-700">
          Add Districts
        </div>
        <div className="text-xs text-gray-400 mt-0.5">
          Click districts on the map to add them
        </div>
      </div>

      {/* Selection indicator */}
      <div className="px-3 pt-3">
        <div className="bg-plum/5 rounded-xl px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-plum animate-pulse" />
          <span className="text-xs text-plum font-medium">
            Selection mode active
          </span>
        </div>
      </div>

      {/* District list */}
      <div className="flex-1 px-3 pt-3 pb-3 overflow-y-auto">
        {planDistrictLeaids.size === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-300 mb-2">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto">
                <circle cx="16" cy="16" r="12" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <path d="M16 12V20M12 16H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs text-gray-400">
              No districts added yet.
              <br />
              Click on the map to add.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {Array.from(planDistrictLeaids).map((leaid) => (
              <div
                key={leaid}
                className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 group"
              >
                <div className="w-2 h-2 rounded-full bg-plum shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700 truncate">
                    District {leaid}
                  </div>
                </div>
                <button
                  onClick={() => removeDistrictFromPlan(leaid)}
                  className="w-5 h-5 rounded-full hover:bg-red-100 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove district ${leaid}`}
                >
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 2L8 8M8 2L2 8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Done button */}
      <div className="px-3 pb-3">
        {addMutation.isError && (
          <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2 mb-2">
            Failed to add districts. Please try again.
          </div>
        )}
        <button
          onClick={handleDone}
          disabled={addMutation.isPending}
          className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all disabled:opacity-40"
        >
          {addMutation.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full tile-loading-spinner" />
              Saving...
            </span>
          ) : (
            `Done (${planDistrictLeaids.size} district${planDistrictLeaids.size !== 1 ? "s" : ""})`
          )}
        </button>
      </div>
    </div>
  );
}
