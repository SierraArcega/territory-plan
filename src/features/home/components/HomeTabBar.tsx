"use client";

import { Home, FileText, Calendar, BarChart3 } from "lucide-react";

export type HomeTab = "feed" | "activities" | "plans" | "dashboard";

interface HomeTabBarProps {
  activeTab: HomeTab;
  onTabChange: (tab: HomeTab) => void;
  badgeCounts: {
    feed: number;
    plans: number;
  };
}

interface TabConfig {
  id: HomeTab;
  label: string;
  icon: typeof Home;
  disabled?: boolean;
}

const TABS: TabConfig[] = [
  { id: "feed", label: "Feed", icon: Home },
  { id: "activities", label: "Activities", icon: Calendar },
  { id: "plans", label: "Plans", icon: FileText },
  { id: "dashboard", label: "Dashboard", icon: BarChart3, disabled: true },
];

export default function HomeTabBar({
  activeTab,
  onTabChange,
  badgeCounts,
}: HomeTabBarProps) {
  return (
    <div className="flex items-center gap-6 px-8 pt-5">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        const count = tab.id === "feed" ? badgeCounts.feed : tab.id === "plans" ? badgeCounts.plans : 0;

        return (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`
              relative flex items-center gap-1.5 pb-3 text-sm font-medium transition-colors
              ${isActive ? "text-[#F37167]" : tab.disabled ? "text-[#A69DC0] cursor-not-allowed" : "text-[#8A80A8] hover:text-[#544A78]"}
            `}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span
                className={`text-[11px] font-semibold px-1.5 min-w-[20px] text-center rounded-full ${
                  isActive
                    ? "bg-[#F37167] text-white"
                    : "bg-[#D4CFE2] text-[#8A80A8]"
                }`}
              >
                {count}
              </span>
            )}
            {isActive && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
            )}
          </button>
        );
      })}
    </div>
  );
}
