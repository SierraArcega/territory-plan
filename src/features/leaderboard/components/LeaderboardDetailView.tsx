"use client";

import RevenueOverviewTab from "./RevenueOverviewTab";

export default function LeaderboardDetailView() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-[#403770] mb-1">Leaderboard</h2>
          <p className="text-sm text-[#8A80A8]">
            Revenue Overview — ranked by current year revenue
          </p>
        </div>

        <RevenueOverviewTab />
      </div>
    </div>
  );
}
