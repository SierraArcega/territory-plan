"use client";

import { useState, useEffect } from "react";
import { useMapStore } from "@/lib/store";
import StateTabContent from "./tabs/StateTabContent";
import DistrictTabContent from "./tabs/DistrictTabContent";
import SchoolTabContent from "./tabs/SchoolTabContent";
import PlansTabContent from "./tabs/PlansTabContent";

type TabType = "state" | "district" | "school" | "plans";

export default function PanelContainer() {
  const {
    sidePanelOpen,
    closePanel,
    activePanelType,
    selectedStateCode,
    selectedLeaid,
    selectedNcessch,
    filters
  } = useMapStore();

  const [activeTab, setActiveTab] = useState<TabType>("state");

  // Auto-switch tabs based on what's selected
  useEffect(() => {
    if (activePanelType === "school" && selectedNcessch) {
      setActiveTab("school");
    } else if (activePanelType === "district" && selectedLeaid) {
      setActiveTab("district");
    } else if (activePanelType === "state" && selectedStateCode) {
      setActiveTab("state");
    }
  }, [activePanelType, selectedLeaid, selectedStateCode, selectedNcessch]);

  if (!sidePanelOpen) {
    return null;
  }

  // Determine if we have context for each tab
  const hasStateContext = !!(selectedStateCode || filters.stateAbbrev);
  const hasDistrictContext = !!selectedLeaid;
  const hasSchoolContext = !!selectedNcessch;
  const effectiveStateCode = selectedStateCode || filters.stateAbbrev;

  const tabs: Array<{ id: TabType; label: string; icon: string; hasContext: boolean }> = [
    {
      id: "state",
      label: "State",
      icon: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7",
      hasContext: hasStateContext
    },
    {
      id: "district",
      label: "District",
      icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
      hasContext: hasDistrictContext
    },
    {
      id: "school",
      label: "School",
      icon: "M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222",
      hasContext: hasSchoolContext
    },
    {
      id: "plans",
      label: "Plans",
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
      hasContext: true // Plans are always available
    },
  ];

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl z-20 flex flex-col overflow-hidden">
      {/* Header with close button and tabs */}
      <div className="flex-shrink-0">
        {/* Close button */}
        <button
          onClick={closePanel}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-[#403770] z-10"
          aria-label="Close panel"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 pt-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? "text-[#403770]"
                  : tab.hasContext
                  ? "text-gray-500 hover:text-gray-700"
                  : "text-gray-300"
              }`}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={tab.icon}
                />
              </svg>
              {tab.label}
              {/* Active indicator dot for tabs with context */}
              {tab.hasContext && tab.id !== "plans" && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#F37167] ml-1" />
              )}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "state" && (
          <StateTabContent stateCode={effectiveStateCode} />
        )}
        {activeTab === "district" && (
          <DistrictTabContent leaid={selectedLeaid} stateCode={effectiveStateCode} />
        )}
        {activeTab === "school" && (
          <SchoolTabContent ncessch={selectedNcessch} />
        )}
        {activeTab === "plans" && (
          <PlansTabContent stateCode={effectiveStateCode} />
        )}
      </div>
    </div>
  );
}
