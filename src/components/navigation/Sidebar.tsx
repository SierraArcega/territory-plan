"use client";

import { useState } from "react";

// Tab configuration - defines all navigation items
// The 'id' matches the activeTab state values we'll use throughout the app
type TabId = "map" | "plans" | "activities" | "goals" | "data" | "profile";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// SVG icons for each tab - kept inline for simplicity
// Using stroke-based icons for consistency with the rest of the app
const MapIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
    />
  </svg>
);

const PlansIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const ActivitiesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const GoalsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 10V3L4 14h7v7l9-11h-7z"
    />
  </svg>
);

const DataIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
    />
  </svg>
);

const ProfileIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

// Chevron icons for collapse/expand toggle
const ChevronLeft = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

// Main navigation tabs (top section of sidebar)
const MAIN_TABS: Tab[] = [
  { id: "map", label: "Map", icon: <MapIcon /> },
  { id: "plans", label: "Plans", icon: <PlansIcon /> },
  { id: "activities", label: "Activities", icon: <ActivitiesIcon /> },
  { id: "goals", label: "Goals", icon: <GoalsIcon /> },
  { id: "data", label: "Data", icon: <DataIcon /> },
];

// Bottom tabs (separated at bottom of sidebar)
const BOTTOM_TABS: Tab[] = [
  { id: "profile", label: "Profile", icon: <ProfileIcon /> },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
}: SidebarProps) {
  // Track which tab is being hovered for tooltip display
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);

  // Render a single tab item
  // Shows icon + label when expanded, icon only (with tooltip) when collapsed
  const renderTab = (tab: Tab) => {
    const isActive = activeTab === tab.id;
    const isHovered = hoveredTab === tab.id;

    return (
      <button
        key={tab.id}
        onClick={() => onTabChange(tab.id)}
        onMouseEnter={() => setHoveredTab(tab.id)}
        onMouseLeave={() => setHoveredTab(null)}
        className={`
          relative w-full flex items-center gap-3 px-4 py-3
          transition-colors duration-150
          ${isActive
            ? "bg-[#FEF2F1] text-[#F37167] border-l-3 border-[#F37167]"
            : "text-[#403770] hover:bg-gray-50 border-l-3 border-transparent"
          }
        `}
        title={collapsed ? tab.label : undefined}
      >
        {/* Icon - always visible */}
        <span className={`flex-shrink-0 ${isActive ? "text-[#F37167]" : "text-[#403770]"}`}>
          {tab.icon}
        </span>

        {/* Label - only visible when expanded */}
        {!collapsed && (
          <span className={`text-sm font-medium truncate ${isActive ? "text-[#F37167]" : ""}`}>
            {tab.label}
          </span>
        )}

        {/* Tooltip - shows on hover when collapsed */}
        {collapsed && isHovered && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-sm rounded shadow-lg whitespace-nowrap z-50">
            {tab.label}
          </div>
        )}
      </button>
    );
  };

  return (
    <aside
      className={`
        flex flex-col bg-white border-r border-gray-200
        transition-all duration-200 ease-in-out
        ${collapsed ? "w-14" : "w-[140px]"}
      `}
    >
      {/* Main navigation tabs */}
      <nav className="flex-1 py-2">
        {MAIN_TABS.map(renderTab)}
      </nav>

      {/* Divider between main tabs and bottom section */}
      <div className="mx-3 border-t border-gray-200" />

      {/* Bottom tabs (Profile) */}
      <nav className="py-2">
        {BOTTOM_TABS.map(renderTab)}
      </nav>

      {/* Collapse/Expand toggle button */}
      <button
        onClick={() => onCollapsedChange(!collapsed)}
        className="
          flex items-center justify-center py-3
          text-gray-400 hover:text-[#403770] hover:bg-gray-50
          transition-colors duration-150 border-t border-gray-200
        "
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>
    </aside>
  );
}

// Export the TabId type for use in other components
export type { TabId };
