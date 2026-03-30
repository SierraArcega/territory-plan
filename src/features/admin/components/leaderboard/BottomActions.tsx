"use client";

import { useState } from "react";
import { Square, Download, RefreshCw } from "lucide-react";
import {
  useEndInitiative,
  useExportHistory,
  useRecalculateScores,
} from "@/features/admin/hooks/useAdminLeaderboard";

export default function BottomActions() {
  const [confirmEnd, setConfirmEnd] = useState(false);

  const endInitiativeMutation = useEndInitiative();
  const exportMutation = useExportHistory();
  const recalcMutation = useRecalculateScores();

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
    </>
  );
}
