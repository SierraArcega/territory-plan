"use client";

import { useState, useCallback } from "react";
import ProfileSidebar from "./ProfileSidebar";
import HomeTabBar, { type HomeTab } from "./HomeTabBar";
import FeedTab from "./FeedTab";
import PlansTab from "./PlansTab";

// ============================================================================
// HomeView — the new Home Base landing page
// ============================================================================

export default function HomeView() {
  const [activeTab, setActiveTab] = useState<HomeTab>("feed");
  const [feedBadge, setFeedBadge] = useState(0);
  const [plansBadge, setPlansBadge] = useState(0);

  const handleFeedBadge = useCallback((count: number) => setFeedBadge(count), []);
  const handlePlansBadge = useCallback((count: number) => setPlansBadge(count), []);

  return (
    <div className="h-full flex bg-[#FFFCFA]">
      {/* Left: Profile sidebar */}
      <ProfileSidebar />

      {/* Right: Tab bar + content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Tab navigation */}
        <HomeTabBar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          badgeCounts={{ feed: feedBadge, plans: plansBadge }}
        />

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {activeTab === "feed" && (
            <FeedTab onBadgeCountChange={handleFeedBadge} />
          )}
          {activeTab === "plans" && (
            <PlansTab onBadgeCountChange={handlePlansBadge} />
          )}
        </div>
      </div>
    </div>
  );
}
