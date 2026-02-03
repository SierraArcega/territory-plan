"use client";

import Sidebar, { TabId } from "@/components/navigation/Sidebar";
import FilterBar from "@/components/filters/FilterBar";

interface AppShellProps {
  // Current active tab - determines which content view to show
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;

  // Sidebar collapsed state
  sidebarCollapsed: boolean;
  onSidebarCollapsedChange: (collapsed: boolean) => void;

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
  children,
}: AppShellProps) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#FFFCFA] overflow-hidden">
      {/* Top: FilterBar - adapts based on active tab */}
      <FilterBar activeTab={activeTab} />

      {/* Main area: Sidebar + Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Sidebar navigation */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={onTabChange}
          collapsed={sidebarCollapsed}
          onCollapsedChange={onSidebarCollapsedChange}
        />

        {/* Right: Content area - fills remaining space */}
        <main className="flex-1 relative overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
