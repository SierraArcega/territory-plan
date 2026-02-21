"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useMapStore, TabId } from "@/lib/store";
import AppShell from "@/features/shared/components/layout/AppShell";
import MapView from "@/features/shared/components/views/MapView";
import PlansView from "@/features/shared/components/views/PlansView";
import ActivitiesView from "@/features/shared/components/views/ActivitiesView";
import TasksView from "@/features/shared/components/views/TasksView";
import HomeView from "@/features/shared/components/views/HomeView";
import ProfileView from "@/features/shared/components/views/ProfileView";

// Valid tab IDs for URL validation
const VALID_TABS: TabId[] = ["home", "map", "plans", "activities", "tasks", "profile"];

function isValidTab(tab: string | null): tab is TabId {
  return tab !== null && VALID_TABS.includes(tab as TabId);
}

/**
 * Main app page - renders the AppShell with sidebar navigation.
 *
 * URL structure:
 * - / or /?tab=home (default)
 * - /?tab=map
 * - /?tab=plans
 * - /?tab=plans&plan=<planId>
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

  // Ref-based flag so the sync effect never runs before init completes.
  // Using a ref (not state) avoids batching issues between Zustand and React setState.
  const initializedRef = useRef(false);
  // Tracks whether the current state change came from browser back/forward
  const isPopstateRef = useRef(false);

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

    // Mark as initialized synchronously — the sync effect (which runs later in
    // the same commit or on the next render) will see this immediately via the ref.
    initializedRef.current = true;
  }, []); // Only run once on mount

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      isPopstateRef.current = true;
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      setActiveTab(isValidTab(tabParam) ? tabParam : "home");
      setSelectedPlanId(params.get("plan"));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [setActiveTab]);

  // Sync URL when activeTab changes (from sidebar clicks)
  useEffect(() => {
    // Skip until the init effect has read URL params and set Zustand state.
    if (!initializedRef.current) return;

    // Skip URL push if this change came from browser back/forward
    if (isPopstateRef.current) {
      isPopstateRef.current = false;
      return;
    }

    // Start from the current URL params so we preserve any extra params
    // (e.g. calendarConnected=true) that other components manage.
    const params = new URLSearchParams(searchParams.toString());

    // Sync the tab param
    if (activeTab === "home") {
      params.delete("tab");
    } else {
      params.set("tab", activeTab);
    }

    // Sync the plan param
    if (activeTab === "plans" && selectedPlanId) {
      params.set("plan", selectedPlanId);
    } else {
      params.delete("plan");
    }

    // Build the new URL
    const newUrl = params.toString() ? `?${params.toString()}` : "/";
    const currentUrl = searchParams.toString()
      ? `?${searchParams.toString()}`
      : "/";

    if (newUrl !== currentUrl) {
      router.push(newUrl, { scroll: false });
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
      case "tasks":
        return <TasksView />;
      case "home":
        return <HomeView />;
      case "profile":
        return <ProfileView />;
      default:
        return <HomeView />;
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
