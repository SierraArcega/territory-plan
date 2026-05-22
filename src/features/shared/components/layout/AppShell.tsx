"use client";

import Sidebar, { TabId } from "@/features/shared/components/navigation/Sidebar";
import BottomNav from "@/features/shared/components/navigation/BottomNav";
import FilterBar from "@/features/shared/components/filters/FilterBar";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";

interface AppShellProps {
  // Current active tab - determines which content view to show
  activeTab: TabId;
  onTabChange: (tab: TabId, adminSection?: string) => void;

  // Sidebar collapsed state
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;

  // Whether the current user has admin role
  isAdmin?: boolean;

  /** When true, the global FilterBar is not rendered. /views/* routes use this. */
  hideFilterBar?: boolean;

  // Content to render in the main area
  children: React.ReactNode;
}

/**
 * AppShell is the main layout wrapper for the entire application.
 * It provides consistent structure across all views:
 *
 * ┌─────────────────────────────────────────────────────┐
 * │  FilterBar (top)                                    │
 * ├──────────┬──────────────────────────────────────────┤
 * │          │                                          │
 * │  Sidebar │         Content Area (children)          │
 * │  (left)  │                                          │
 * │          │                                          │
 * └──────────┴──────────────────────────────────────────┘
 *
 * The FilterBar adapts based on the active tab (full controls on Map,
 * minimal on other tabs). The Sidebar handles navigation between views.
 */
export default function AppShell({
  activeTab,
  onTabChange,
  sidebarCollapsed,
  onSidebarCollapsedChange,
  isAdmin = false,
  hideFilterBar = false,
  children,
}: AppShellProps) {
  const isMobile = useIsMobile();

  return (
    <div className="fixed inset-0 h-dvh flex flex-col bg-[#FFFCFA] overflow-hidden overscroll-none">
      {/* Top: FilterBar - adapts based on active tab */}
      {!hideFilterBar && <FilterBar activeTab={activeTab} />}

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Sidebar navigation — desktop only */}
        {!isMobile && (
          <Sidebar
            activeTab={activeTab}
            onTabChange={onTabChange}
            collapsed={sidebarCollapsed}
            onCollapsedChange={onSidebarCollapsedChange}
            isAdmin={isAdmin}
          />
        )}

        {/* Content area - fills remaining space */}
        <main className="flex-1 h-full relative overflow-hidden">
          {children}
        </main>
      </div>

      {/* Bottom: BottomNav — mobile only */}
      {isMobile && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={onTabChange}
          isAdmin={isAdmin}
        />
      )}
    </div>
  );
}
