"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProfileSidebar from "./ProfileSidebar";
import HomeTabBar, { type HomeTab } from "./HomeTabBar";
import FeedTab from "./FeedTab";
import ActivitiesTab from "./ActivitiesTab";
import PlansTab from "./PlansTab";
import {
  useAutoSyncCalendarOnMount,
  useBackfillStatus,
} from "@/features/calendar/lib/queries";
import BackfillSetupModal from "@/features/calendar/components/backfill/BackfillSetupModal";
import CalendarSyncToast from "@/features/calendar/components/CalendarSyncToast";

// ============================================================================
// HomeView — the new Home Base landing page
// ============================================================================

export default function HomeView() {
  const [activeTab, setActiveTab] = useState<HomeTab>("feed");
  const [feedBadge, setFeedBadge] = useState(0);
  const [plansBadge, setPlansBadge] = useState(0);

  const handleFeedBadge = useCallback((count: number) => setFeedBadge(count), []);
  const handlePlansBadge = useCallback((count: number) => setPlansBadge(count), []);

  // Calendar sync integration
  const router = useRouter();
  const searchParams = useSearchParams();
  const backfillStatus = useBackfillStatus();
  const autoSync = useAutoSyncCalendarOnMount();

  const [backfillModalOpen, setBackfillModalOpen] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastCount, setToastCount] = useState(0);

  // Open the backfill modal on the right triggers and strip transient flags.
  // Explicit user intent (query params) always opens. Implicit open based on
  // backfill status only fires AT MOST ONCE per HomeView mount — so closing
  // the modal via "Maybe later" sticks instead of bouncing back open on the
  // next render.
  const hasAutoOpenedRef = useRef(false);
  useEffect(() => {
    const justConnected = searchParams?.get("calendarJustConnected") === "true";
    const resumeBackfill = searchParams?.get("resumeBackfill") === "true";

    if (justConnected || resumeBackfill) {
      setBackfillModalOpen(true);
    } else if (
      !hasAutoOpenedRef.current &&
      (backfillStatus.needsSetup || backfillStatus.needsResume)
    ) {
      hasAutoOpenedRef.current = true;
      setBackfillModalOpen(true);
    }

    if (justConnected || resumeBackfill) {
      const next = new URLSearchParams(searchParams?.toString() ?? "");
      next.delete("calendarJustConnected");
      next.delete("resumeBackfill");
      next.delete("from");
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : "?tab=home", { scroll: false });
    }
  }, [searchParams, router, backfillStatus.needsSetup, backfillStatus.needsResume]);

  // Navigation handler used by the backfill completion screen CTA — closes the
  // modal and routes the rep to the Activities tab so they can see what landed.
  const handleGoToActivities = () => {
    setBackfillModalOpen(false);
    router.push("?tab=activities");
  };

  // Hook the auto-sync "new events arrived" callback up to the toast
  useEffect(() => {
    autoSync.setOnNewEvents((n) => {
      setToastCount(n);
      setToastVisible(true);
    });
  }, [autoSync]);

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
          {activeTab === "activities" && (
            <ActivitiesTab />
          )}
          {activeTab === "plans" && (
            <PlansTab onBadgeCountChange={handlePlansBadge} />
          )}
        </div>
      </div>

      {/* Calendar backfill wizard + post-sync toast */}
      <BackfillSetupModal
        isOpen={backfillModalOpen}
        onClose={() => setBackfillModalOpen(false)}
        initialStep={backfillStatus.needsResume ? "wizard" : "picker"}
        onGoToActivities={handleGoToActivities}
      />
      <CalendarSyncToast
        visible={toastVisible}
        newEventCount={toastCount}
        onDismiss={() => setToastVisible(false)}
        onReview={() => {
          setToastVisible(false);
          router.push("?tab=activities");
        }}
      />
    </div>
  );
}
