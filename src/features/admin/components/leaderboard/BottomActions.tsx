"use client";

import { useState } from "react";
import { Plus, Square, Download } from "lucide-react";
import {
  useCreateNewSeason,
  useEndSeason,
  useExportHistory,
} from "@/features/admin/hooks/useAdminLeaderboard";

export default function BottomActions() {
  const [confirmEnd, setConfirmEnd] = useState(false);

  const newSeasonMutation = useCreateNewSeason();
  const endSeasonMutation = useEndSeason();
  const exportMutation = useExportHistory();

  const handleNewSeason = () => {
    if (
      window.confirm(
        "Create a new season? This will end the current season and copy its config as a template."
      )
    ) {
      newSeasonMutation.mutate();
    }
  };

  const handleEndSeason = () => {
    if (confirmEnd) {
      endSeasonMutation.mutate(undefined, { onSuccess: () => setConfirmEnd(false) });
    } else {
      setConfirmEnd(true);
    }
  };

  return (
    <div className="flex items-center gap-3 pt-4">
      <button
        onClick={handleNewSeason}
        disabled={newSeasonMutation.isPending}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
      >
        <Plus className="w-4 h-4" />
        {newSeasonMutation.isPending ? "Creating..." : "New Season"}
      </button>

      <button
        onClick={handleEndSeason}
        disabled={endSeasonMutation.isPending}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          confirmEnd
            ? "text-white bg-[#F37167] hover:bg-[#e0635a]"
            : "text-[#F37167] border border-[#F37167] hover:bg-[#fef1f0]"
        }`}
      >
        <Square className="w-4 h-4" />
        {confirmEnd
          ? endSeasonMutation.isPending
            ? "Ending..."
            : "Confirm End Season"
          : "End Current Season"}
      </button>

      <button
        onClick={() => exportMutation.mutate()}
        disabled={exportMutation.isPending}
        className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#6E6390] border border-[#D4CFE2] hover:bg-[#F7F5FA] rounded-lg transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        {exportMutation.isPending ? "Exporting..." : "Export Season History"}
      </button>
    </div>
  );
}
