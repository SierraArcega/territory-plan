"use client";

import { Trophy } from "lucide-react";
import { useCreateNewInitiative } from "@/features/admin/hooks/useAdminLeaderboard";

export default function EmptyState() {
  const newInitiativeMutation = useCreateNewInitiative();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EFEDF5] flex items-center justify-center mb-4">
        <Trophy className="w-8 h-8 text-[#8A80A8]" />
      </div>
      <h3 className="text-lg font-semibold text-[#403770] mb-2">No Active Initiative</h3>
      <p className="text-sm text-[#8A80A8] max-w-md mb-6">
        Create your first initiative to start the leaderboard. It will come pre-configured with 3
        default metrics and standard tier thresholds.
      </p>
      <button
        onClick={() => newInitiativeMutation.mutate()}
        disabled={newInitiativeMutation.isPending}
        className="px-6 py-3 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
      >
        {newInitiativeMutation.isPending ? "Creating..." : "Create Your First Initiative"}
      </button>
    </div>
  );
}
