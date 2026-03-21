"use client";

import { useState } from "react";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";
import PlanDistrictsTab from "./PlanDistrictsTab";
import PlanContactsTab from "./PlanContactsTab";
import PlanActivitiesTab from "./PlanActivitiesTab";
import PlanTasksTab from "./PlanTasksTab";
import PlanOpportunitiesTab from "./PlanOpportunitiesTab";

type Tab = "districts" | "contacts" | "activities" | "tasks" | "opportunities";

const TABS: { key: Tab; label: string }[] = [
  { key: "districts", label: "Districts" },
  { key: "opportunities", label: "Opportunities" },
  { key: "contacts", label: "Contacts" },
  { key: "activities", label: "Activities" },
  { key: "tasks", label: "Tasks" },
];

interface PlanDetailTabsProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
}

export default function PlanDetailTabs({ plan, onClose }: PlanDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("districts");

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Tab strip */}
      <div className="shrink-0 border-b border-[#E2DEEC] flex items-center px-5 pt-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = getTabCount(plan, tab.key);

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="relative px-4 py-3 text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                color: isActive ? "#403770" : "#8A80A8",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {tab.label}
              {count != null && count > 0 && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: isActive ? "rgba(64,55,112,0.08)" : "#f0edf5",
                    color: isActive ? "#403770" : "#8A80A8",
                  }}
                >
                  {count}
                </span>
              )}
              {isActive && (
                <span className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full bg-[#403770]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "districts" && (
          <PlanDistrictsTab plan={plan} onClose={onClose} />
        )}
        {activeTab === "opportunities" && (
          <PlanOpportunitiesTab planId={plan.id} />
        )}
        {activeTab === "contacts" && <PlanContactsTab planId={plan.id} />}
        {activeTab === "activities" && <PlanActivitiesTab planId={plan.id} />}
        {activeTab === "tasks" && <PlanTasksTab planId={plan.id} />}
      </div>
    </div>
  );
}

function getTabCount(plan: TerritoryPlanDetail, tab: Tab): number | null {
  switch (tab) {
    case "districts":
      return plan.districts.length;
    case "tasks":
      return plan.taskCount > 0 ? plan.taskCount : null;
    default:
      return null;
  }
}
