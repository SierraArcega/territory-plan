"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Apple } from "lucide-react";
import LeaderboardNavWidget from "@/features/leaderboard/components/LeaderboardNavWidget";
import LeaderboardModal from "@/features/leaderboard/components/LeaderboardModal";

// Tab configuration - defines all navigation items
// The 'id' matches the activeTab state values we'll use throughout the app
type TabId = "home" | "map" | "plans" | "activities" | "tasks" | "leaderboard" | "low-hanging-fruit" | "resources" | "profile" | "admin";

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// Admin sub-item labels (rendered inside sidebar when expanded)
const ADMIN_SUB_ITEMS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "unmatched", label: "Unmatched Opps" },
  { id: "users", label: "Users" },
  { id: "integrations", label: "Integrations" },
  { id: "sync", label: "Data Sync" },
  { id: "leaderboard", label: "Leaderboard" },
];

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

// Task list icon — checkbox with lines, distinct from Plans clipboard
const TasksIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7l2 2 4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 7h6" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 17l2 2 4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 17h6" />
  </svg>
);

const ResourcesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
  </svg>
);


const HomeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1h-2z"
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

const LeaderboardIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h8m-4-4v4m-4.5-8l-2-6h13l-2 6m-9 0h9m-9 0a2.5 2.5 0 01-2.5-2.5M15.5 7a2.5 2.5 0 002.5-2.5M6 7l-1-4h14l-1 4" />
  </svg>
);

const LowHangingFruitIcon = () => <Apple className="w-5 h-5" />;

// Admin gear icon
const AdminIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
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

const ChevronDown = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Main navigation tabs (top section of sidebar)
const MAIN_TABS: Tab[] = [
  { id: "home", label: "Home", icon: <HomeIcon /> },
  { id: "map", label: "Map", icon: <MapIcon /> },
  { id: "plans", label: "Plans", icon: <PlansIcon /> },
  { id: "activities", label: "Activities", icon: <ActivitiesIcon /> },
  { id: "tasks", label: "Tasks", icon: <TasksIcon /> },
  { id: "leaderboard", label: "Leaderboard", icon: <LeaderboardIcon /> },
  { id: "low-hanging-fruit", label: "Low Hanging Fruit", icon: <LowHangingFruitIcon /> },
  { id: "resources", label: "Resources", icon: <ResourcesIcon /> },
];

// Bottom tabs (separated at bottom of sidebar)
const BOTTOM_TABS: Tab[] = [
  { id: "profile", label: "Profile", icon: <ProfileIcon /> },
];

interface SidebarProps {
  activeTab: TabId;
  onTabChange: (tab: TabId, adminSection?: string) => void;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  isAdmin?: boolean;
}

export default function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onCollapsedChange,
  isAdmin = false,
}: SidebarProps) {
  const router = useRouter();
  // Track which tab is being hovered for tooltip display
  const [hoveredTab, setHoveredTab] = useState<TabId | null>(null);
  // Admin section expand/collapse
  const [adminExpanded, setAdminExpanded] = useState(false);
  // Track hovered admin item for collapsed tooltip
  const [hoveredAdmin, setHoveredAdmin] = useState<string | null>(null);
  // Leaderboard modal
  const [showLeaderboard, setShowLeaderboard] = useState(false);

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
            : "text-[#403770] hover:bg-[#EFEDF5] border-l-3 border-transparent"
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
          <div className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
            {tab.label}
          </div>
        )}
      </button>
    );
  };

  // Render the admin section (expandable with sub-items)
  const renderAdminSection = () => {
    if (!isAdmin) return null;

    const isAdminActive = activeTab === "admin";

    return (
      <>
        <div className="mx-3 border-t border-[#E2DEEC]" />
        <div className="py-1">
          {/* Admin header — toggles expand/collapse, or navigates when collapsed */}
          <button
            onClick={() => {
              if (collapsed) {
                onTabChange("admin" as TabId);
              } else {
                setAdminExpanded(!adminExpanded);
              }
            }}
            onMouseEnter={() => setHoveredAdmin("admin-header")}
            onMouseLeave={() => setHoveredAdmin(null)}
            className={`
              relative w-full flex items-center gap-3 px-4 py-3
              transition-colors duration-150 border-l-3
              ${isAdminActive
                ? "bg-[#FEF2F1] text-[#F37167] border-[#F37167]"
                : "text-[#403770] hover:bg-[#EFEDF5] border-transparent"
              }
            `}
            title={collapsed ? "Admin" : undefined}
          >
            <span className={`flex-shrink-0 ${isAdminActive ? "text-[#F37167]" : "text-[#403770]"}`}>
              <AdminIcon />
            </span>
            {!collapsed && (
              <>
                <span className={`text-sm font-medium truncate ${isAdminActive ? "text-[#F37167]" : ""}`}>Admin</span>
                <span
                  className={`ml-auto flex-shrink-0 transition-transform duration-150 ${
                    adminExpanded ? "" : "-rotate-90"
                  }`}
                >
                  <ChevronDown />
                </span>
              </>
            )}
            {/* Tooltip when collapsed */}
            {collapsed && hoveredAdmin === "admin-header" && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#403770] text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50">
                Admin
              </div>
            )}
          </button>

          {/* Admin sub-items — visible when expanded and sidebar is not collapsed */}
          {!collapsed && adminExpanded && (
            <nav className="flex flex-col">
              {ADMIN_SUB_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onTabChange("admin" as TabId, item.id)}
                  onMouseEnter={() => setHoveredAdmin(item.id)}
                  onMouseLeave={() => setHoveredAdmin(null)}
                  className="flex items-center pl-12 pr-4 py-2 text-[13px] font-medium text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770] transition-colors duration-100 w-full text-left"
                >
                  {item.label}
                </button>
              ))}
            </nav>
          )}
        </div>
      </>
    );
  };

  return (
    <>
    <aside
      className={`
        flex flex-col bg-white border-r border-[#D4CFE2]
        transition-all duration-200 ease-in-out
        ${collapsed ? "w-14" : "w-[140px]"}
      `}
    >
      {/* Main navigation tabs */}
      <nav className="flex-1 py-2">
        {MAIN_TABS.map(renderTab)}
      </nav>

      {/* Admin section (expandable, only for admins) */}
      {renderAdminSection()}

      {/* Divider between main/admin tabs and bottom section */}
      <div className="mx-3 border-t border-[#E2DEEC]" />

      {/* Leaderboard widget — above Profile */}
      <div className="py-1">
        <LeaderboardNavWidget
          collapsed={collapsed}
          onOpenModal={() => setShowLeaderboard(true)}
        />
      </div>

      {/* Bottom tabs (Profile) */}
      <nav className="py-2">
        {BOTTOM_TABS.map(renderTab)}
      </nav>

      {/* Collapse/Expand toggle button */}
      <button
        onClick={() => onCollapsedChange(!collapsed)}
        className="
          flex items-center justify-center py-3
          text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5]
          transition-colors duration-150 border-t border-[#E2DEEC]
        "
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronRight /> : <ChevronLeft />}
      </button>
    </aside>

    {/* Leaderboard modal — rendered outside aside for proper z-index */}
    <LeaderboardModal
      isOpen={showLeaderboard}
      onClose={() => setShowLeaderboard(false)}
      onNavigateToDetails={() => onTabChange("leaderboard" as TabId)}
    />
    </>
  );
}

// Export the TabId type for use in other components
export type { TabId };
