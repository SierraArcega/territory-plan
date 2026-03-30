"use client";

import { useState } from "react";
import { Plus, Square, Download, History, RotateCcw, RefreshCw } from "lucide-react";
import {
  useCreateNewInitiative,
  useEndInitiative,
  useExportHistory,
  useRecalculateScores,
} from "@/features/admin/hooks/useAdminLeaderboard";

export default function BottomActions() {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);

  const newInitiativeMutation = useCreateNewInitiative();
  const endInitiativeMutation = useEndInitiative();
  const exportMutation = useExportHistory();
  const recalcMutation = useRecalculateScores();

  const handleCreate = (backfill: boolean) => {
    newInitiativeMutation.mutate(
      { backfill },
      { onSuccess: () => setShowNewModal(false) }
    );
  };

  const handleEndInitiative = () => {
    if (confirmEnd) {
      endInitiativeMutation.mutate(undefined, { onSuccess: () => setConfirmEnd(false) });
    } else {
      setConfirmEnd(true);
    }
  };

  return (
    <>
      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={() => setShowNewModal(true)}
          disabled={newInitiativeMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {newInitiativeMutation.isPending ? "Creating..." : "New Initiative"}
        </button>

        <button
          onClick={handleEndInitiative}
          disabled={endInitiativeMutation.isPending}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
            confirmEnd
              ? "text-white bg-[#F37167] hover:bg-[#e0635a]"
              : "text-[#F37167] border border-[#F37167] hover:bg-[#fef1f0]"
          }`}
        >
          <Square className="w-4 h-4" />
          {confirmEnd
            ? endInitiativeMutation.isPending
              ? "Ending..."
              : "Confirm End Initiative"
            : "End Current Initiative"}
        </button>

        <button
          onClick={() => recalcMutation.mutate()}
          disabled={recalcMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#403770] border border-[#403770] hover:bg-[#F7F5FA] rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${recalcMutation.isPending ? "animate-spin" : ""}`} />
          {recalcMutation.isPending ? "Recalculating..." : "Recalculate Scores"}
        </button>

        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#6E6390] border border-[#D4CFE2] hover:bg-[#F7F5FA] rounded-lg transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          {exportMutation.isPending ? "Exporting..." : "Export Initiative History"}
        </button>
      </div>

      {/* New Initiative Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-[#403770] mb-2">Create New Initiative</h3>
            <p className="text-sm text-[#6E6390] mb-6">
              This will end the current initiative and create a new one with the same config. How should initial scores be set?
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleCreate(false)}
                disabled={newInitiativeMutation.isPending}
                className="w-full flex items-start gap-4 p-4 border border-[#E2DEEC] rounded-lg hover:border-[#403770] hover:bg-[#F7F5FA] transition-colors text-left disabled:opacity-50"
              >
                <div className="mt-0.5">
                  <RotateCcw className="w-5 h-5 text-[#403770]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#403770]">Fresh Start</div>
                  <div className="text-xs text-[#8A80A8] mt-0.5">
                    Everyone starts at 0 points. Only new actions earn points going forward.
                  </div>
                </div>
              </button>

              <button
                onClick={() => handleCreate(true)}
                disabled={newInitiativeMutation.isPending}
                className="w-full flex items-start gap-4 p-4 border border-[#E2DEEC] rounded-lg hover:border-[#403770] hover:bg-[#F7F5FA] transition-colors text-left disabled:opacity-50"
              >
                <div className="mt-0.5">
                  <History className="w-5 h-5 text-[#403770]" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#403770]">Historical Backfill</div>
                  <div className="text-xs text-[#8A80A8] mt-0.5">
                    Calculate base scores from existing plans, activities, and revenue targets.
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowNewModal(false)}
                className="px-4 py-2 text-sm text-[#6E6390] hover:bg-[#F7F5FA] rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
