"use client";

import { Play } from "lucide-react";
import { useExecutions } from "../lib/queries";
import type { SequenceExecutionData } from "../types";
import ActiveRunCard from "./ActiveRunCard";

interface ActiveRunsTabProps {
  onResume: (executionId: number) => void;
}

export default function ActiveRunsTab({ onResume }: ActiveRunsTabProps) {
  const {
    data: activeRuns,
    isLoading: activeLoading,
  } = useExecutions("active");
  const {
    data: pausedRuns,
    isLoading: pausedLoading,
  } = useExecutions("paused");

  const isLoading = activeLoading || pausedLoading;
  const allRuns = [...(activeRuns || []), ...(pausedRuns || [])];

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#D4CFE2] rounded-lg p-4 shadow-sm animate-pulse"
          >
            <div className="h-4 w-40 bg-[#EFEDF5] rounded mb-3" />
            <div className="h-1.5 w-full bg-[#EFEDF5] rounded-full mb-3" />
            <div className="h-3 w-24 bg-[#EFEDF5] rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (allRuns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-14 h-14 rounded-full bg-[#EFEDF5] flex items-center justify-center mb-4">
          <Play className="w-6 h-6 text-[#A69DC0]" />
        </div>
        <h3 className="text-sm font-semibold text-[#403770] mb-1">
          No active runs
        </h3>
        <p className="text-sm text-[#8A80A8] text-center max-w-sm">
          Start a sequence from the Sequences tab to begin outreach.
        </p>
      </div>
    );
  }

  // Split by status for display
  const active = allRuns.filter((r) => r.status === "active");
  const paused = allRuns.filter((r) => r.status === "paused");

  return (
    <div className="space-y-6">
      {active.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
            Active ({active.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {active.map((execution) => (
              <ActiveRunCard
                key={execution.id}
                execution={execution}
                onResume={onResume}
              />
            ))}
          </div>
        </div>
      )}

      {paused.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
            Paused ({paused.length})
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {paused.map((execution) => (
              <ActiveRunCard
                key={execution.id}
                execution={execution}
                onResume={onResume}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get badge count for the Active Runs tab header.
 */
export function useActiveRunsCount(): number {
  const { data: active } = useExecutions("active");
  const { data: paused } = useExecutions("paused");
  return (active?.length || 0) + (paused?.length || 0);
}
