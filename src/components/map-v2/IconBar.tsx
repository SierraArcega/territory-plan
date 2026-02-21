"use client";

import { useState } from "react";
import { useMapV2Store, type IconBarTab } from "@/features/map/lib/store";
import { useProfile } from "@/lib/api";

const tabs: Array<{ id: IconBarTab; icon: string; label: string }> = [
  { id: "home", icon: "home", label: "Home" },
  { id: "search", icon: "search", label: "Search" },
  { id: "plans", icon: "plans", label: "Plans" },
  { id: "explore", icon: "explore", label: "Explore" },
  { id: "settings", icon: "settings", label: "Settings" },
];

function ProfileAvatar({ active, avatarUrl, initials }: { active: boolean; avatarUrl: string | null; initials: string }) {
  const [imgError, setImgError] = useState(false);

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt="Profile"
        onError={() => setImgError(true)}
        className={`w-7 h-7 rounded-full object-cover ring-2 transition-all ${
          active ? "ring-plum" : "ring-transparent"
        }`}
      />
    );
  }

  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
        active
          ? "bg-plum text-white ring-2 ring-plum/30"
          : "bg-gray-200 text-gray-500"
      }`}
    >
      {initials}
    </div>
  );
}

function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#403770" : "#9CA3AF";

  switch (type) {
    case "search":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle
            cx="9"
            cy="9"
            r="5.5"
            stroke={color}
            strokeWidth="1.5"
          />
          <path
            d="M13.5 13.5L17 17"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "plans":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect
            x="3"
            y="3"
            width="14"
            height="14"
            rx="2"
            stroke={color}
            strokeWidth="1.5"
            fill={active ? color + "20" : "none"}
          />
          <path
            d="M7 7H13M7 10H13M7 13H10"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "explore":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M4 16V10M8 16V6M12 16V8M16 16V4"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="3" stroke={color} strokeWidth="1.5" />
          <path
            d="M10 2V4M10 16V18M18 10H16M4 10H2M15.66 4.34L14.24 5.76M5.76 14.24L4.34 15.66M15.66 15.66L14.24 14.24M5.76 5.76L4.34 4.34"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  return email.substring(0, 1).toUpperCase();
}

export default function IconBar() {
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);
  const setActiveIconTab = useMapV2Store((s) => s.setActiveIconTab);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);
  const collapsePanel = useMapV2Store((s) => s.collapsePanel);
  const { data: profile } = useProfile();

  const initials = profile
    ? getInitials(profile.fullName, profile.email)
    : "?";

  return (
    <div className="flex flex-col items-center py-3 gap-1 w-[56px] border-r border-gray-200/60">
      {/* Collapse / hide chevron */}
      <button
        onClick={collapsePanel}
        className="w-9 h-5 rounded-md flex items-center justify-center text-gray-300 hover:text-plum hover:bg-gray-100 transition-all mb-1 group relative"
        title="Minimize panel"
        aria-label="Minimize panel"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M8.5 3.5L5 7L8.5 10.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          Hide panel
        </span>
      </button>

      {tabs.map((tab) => {
        const isHome = tab.id === "home";
        const isActive = activeIconTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => setActiveIconTab(tab.id)}
            className={`
              w-9 h-9 rounded-xl flex items-center justify-center
              transition-all duration-150 relative group
              ${isHome ? "" : isActive ? "bg-plum/10 shadow-sm" : "hover:bg-gray-100"}
            `}
            title={isHome ? profile?.fullName || "Home" : tab.label}
            aria-label={isHome ? profile?.fullName || "Home" : tab.label}
            aria-current={isActive ? "page" : undefined}
          >
            {isHome ? (
              <ProfileAvatar
                active={isActive}
                avatarUrl={profile?.avatarUrl || null}
                initials={initials}
              />
            ) : (
              <TabIcon type={tab.icon} active={isActive} />
            )}

            {/* Tooltip */}
            <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
              {isHome ? profile?.fullName || "Home" : tab.label}
            </span>
          </button>
        );
      })}

      {/* Spacer */}
      <div className="flex-1" />

      {/* New Plan quick action */}
      <button
        onClick={startNewPlan}
        className="w-9 h-9 rounded-xl flex items-center justify-center bg-plum text-white hover:bg-plum/90 transition-all duration-150 hover:scale-105 shadow-sm group relative"
        title="New Plan"
        aria-label="Create new plan"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 3V13M3 8H13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>

        <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
          New Plan
        </span>
      </button>
    </div>
  );
}
