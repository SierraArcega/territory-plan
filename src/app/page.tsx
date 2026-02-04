"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMapStore, TabId } from "@/lib/store";
import AppShell from "@/components/layout/AppShell";
import MapView from "@/components/views/MapView";
import PlansView from "@/components/views/PlansView";
import ActivitiesView from "@/components/views/ActivitiesView";
import GoalsView from "@/components/views/GoalsView";
import DataView from "@/components/views/DataView";
import ProfileView from "@/components/views/ProfileView";

// Valid tab IDs for URL validation
const VALID_TABS: TabId[] = ["map", "plans", "activities", "goals", "data", "profile"];

function isValidTab(tab: string | null): tab is TabId {
  return tab !== null && VALID_TABS.includes(tab as TabId);
}

/**
 * Main app page - renders the AppShell with sidebar navigation.
 *
 * URL structure:
 * - /?tab=map (default)
 * - /?tab=plans
 * - /?tab=plans&plan=<planId>
 * - /?tab=goals
 * - /?tab=data
 * - /?tab=profile
 *
 * The URL is synced with the active tab state, allowing for shareable links.
 */
export default function Home() {
  // Wrap in Suspense because useSearchParams requires it for static generation
  return (
    <Suspense fallback={<LoadingFallback />}>
      <HomeContent />
    </Suspense>
  );
}

// Loading fallback shown during initial load
function LoadingFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#FFFCFA]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
        <p className="text-[#403770] font-medium">Loading...</p>
      </div>
    </div>
  );
}

// Actual home content with URL param handling
function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get state from Zustand store
  const {
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useMapStore();

  // Track the selected plan ID for PlansView (from URL)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Initialize state from URL params on mount
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    const planParam = searchParams.get("plan");

    // Set active tab from URL if valid
    if (isValidTab(tabParam)) {
      setActiveTab(tabParam);
    }

    // Set selected plan from URL if on plans tab
    if (planParam) {
      setSelectedPlanId(planParam);
    }
  }, []); // Only run once on mount

  // Sync URL when activeTab changes (from sidebar clicks)
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    const currentPlan = searchParams.get("plan");

    // Build new URL params
    const params = new URLSearchParams();

    // Only add tab param if not "map" (default)
    if (activeTab !== "map") {
      params.set("tab", activeTab);
    }

    // Keep plan param if on plans tab
    if (activeTab === "plans" && selectedPlanId) {
      params.set("plan", selectedPlanId);
    }

    // Update URL without navigation (replace, not push)
    const newUrl = params.toString() ? `?${params.toString()}` : "/";

    // Only update if changed
    const currentUrl = currentTab || currentPlan
      ? `?${searchParams.toString()}`
      : "/";

    if (newUrl !== currentUrl) {
      router.replace(newUrl, { scroll: false });
    }
  }, [activeTab, selectedPlanId, router, searchParams]);

  // Handle plan selection changes (for URL sync)
  const handlePlanChange = (planId: string | null) => {
    setSelectedPlanId(planId);
  };

  // Render the active view based on current tab
  const renderContent = () => {
    switch (activeTab) {
      case "map":
        return <MapView />;
      case "plans":
        return (
          <PlansView
            initialPlanId={selectedPlanId}
            onPlanChange={handlePlanChange}
          />
        );
      case "activities":
        return <ActivitiesView />;
      case "goals":
        return <GoalsView />;
      case "data":
        return <DataView />;
      case "profile":
        return <ProfileView />;
      default:
        return <MapView />;
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onTabChange={(tab) => {
        setActiveTab(tab);
        // Clear plan selection when switching away from plans
        if (tab !== "plans") {
          setSelectedPlanId(null);
        }
      }}
      sidebarCollapsed={sidebarCollapsed}
      onSidebarCollapsedChange={setSidebarCollapsed}
    >
      {renderContent()}
    </AppShell>
  );
}
