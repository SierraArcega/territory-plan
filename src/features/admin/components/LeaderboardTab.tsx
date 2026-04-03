"use client";

import { useAdminLeaderboardConfig } from "@/features/admin/hooks/useAdminLeaderboard";
import InitiativeIdentity from "./leaderboard/InitiativeIdentity";
import ScoringMetrics from "./leaderboard/ScoringMetrics";
import TierThresholds from "./leaderboard/TierThresholds";
import CombinedWeights from "./leaderboard/CombinedWeights";

import BottomActions from "./leaderboard/BottomActions";
import EmptyState from "./leaderboard/EmptyState";

function LeaderboardSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-16 bg-[#E2DEEC]/40 rounded-xl animate-pulse" />
      ))}
    </div>
  );
}

export default function LeaderboardTab() {
  const { data, isLoading, isError } = useAdminLeaderboardConfig();

  if (isLoading) return <LeaderboardSkeleton />;

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#F37167]">Failed to load leaderboard configuration.</p>
      </div>
    );
  }

  if (!data?.initiative) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      <InitiativeIdentity config={data} />
      <ScoringMetrics config={data} />
      <TierThresholds config={data} />
      <CombinedWeights config={data} />
      <BottomActions />
    </div>
  );
}
