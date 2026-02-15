"use client";

import { useMapV2Store, type IconBarTab } from "@/lib/map-v2-store";

const tabs: Array<{ id: IconBarTab; icon: string; label: string }> = [
  { id: "home", icon: "home", label: "Home" },
  { id: "layers", icon: "layers", label: "Layers" },
  { id: "plans", icon: "plans", label: "Plans" },
  { id: "settings", icon: "settings", label: "Settings" },
];

function TabIcon({ type, active }: { type: string; active: boolean }) {
  const color = active ? "#403770" : "#9CA3AF";

  switch (type) {
    case "home":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M3 10L10 3L17 10V17C17 17.5523 16.5523 18 16 18H4C3.44772 18 3 17.5523 3 17V10Z"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? color + "20" : "none"}
          />
          <path
            d="M8 18V12H12V18"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "layers":
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path
            d="M2 10L10 14L18 10"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 14L10 18L18 14"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
          <path
            d="M2 6L10 10L18 6L10 2L2 6Z"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill={active ? color + "20" : "none"}
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

export default function IconBar() {
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);
  const setActiveIconTab = useMapV2Store((s) => s.setActiveIconTab);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);

  return (
    <div className="flex flex-col items-center py-3 gap-1 w-[44px] border-r border-gray-200/60">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            if (tab.id === "plans") {
              setActiveIconTab("plans");
            } else {
              setActiveIconTab(tab.id);
            }
          }}
          className={`
            w-9 h-9 rounded-xl flex items-center justify-center
            transition-all duration-150 relative group
            ${
              activeIconTab === tab.id
                ? "bg-plum/10 shadow-sm"
                : "hover:bg-gray-100"
            }
          `}
          title={tab.label}
          aria-label={tab.label}
          aria-current={activeIconTab === tab.id ? "page" : undefined}
        >
          <TabIcon type={tab.icon} active={activeIconTab === tab.id} />

          {/* Tooltip */}
          <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
            {tab.label}
          </span>
        </button>
      ))}

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
