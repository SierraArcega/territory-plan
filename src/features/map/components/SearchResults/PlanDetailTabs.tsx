"use client";

import { useState, useMemo } from "react";
import type {
  TerritoryPlanDetail,
  ActivitiesResponse,
  TasksResponse,
} from "@/features/shared/types/api-types";
import {
  usePlanOpportunities,
  usePlanContacts,
  useActivities,
  useTasks,
} from "@/lib/api";
import PlanDistrictsTab from "./PlanDistrictsTab";
import PlanContactsTab from "./PlanContactsTab";
import PlanActivitiesTab from "./PlanActivitiesTab";
import PlanTasksTab from "./PlanTasksTab";
import PlanOpportunitiesTab from "./PlanOpportunitiesTab";
import PlanVacanciesTab from "./PlanVacanciesTab";
import { usePlanVacancies } from "@/features/vacancies/lib/queries";

type Tab = "districts" | "contacts" | "activities" | "tasks" | "opportunities" | "vacancies";

const TABS: { key: Tab; label: string }[] = [
  { key: "districts", label: "Districts" },
  { key: "opportunities", label: "Opportunities" },
  { key: "contacts", label: "Contacts" },
  { key: "activities", label: "Activities" },
  { key: "tasks", label: "Tasks" },
  { key: "vacancies", label: "Vacancies" },
];

interface PlanDetailTabsProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
}

export default function PlanDetailTabs({ plan, onClose }: PlanDetailTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("districts");

  // Fetch counts for each tab — shares TanStack Query cache with tab content
  const { data: opportunities } = usePlanOpportunities(plan.id);
  const { data: contacts } = usePlanContacts(plan.id);
  const { data: activitiesData } = useActivities({ planId: plan.id });
  const { data: tasksData } = useTasks({ planId: plan.id });
  const { data: vacanciesData } = usePlanVacancies(plan.id);

  const tabCounts = useMemo(() => {
    const activitiesResponse = activitiesData as ActivitiesResponse | undefined;
    const tasksResponse = tasksData as TasksResponse | undefined;
    return {
      districts: plan.districts.length,
      opportunities: opportunities?.length ?? null,
      contacts: contacts?.length ?? null,
      activities: activitiesResponse?.activities?.length ?? null,
      tasks: tasksResponse?.tasks?.length ?? null,
      vacancies: vacanciesData?.vacancies?.length ?? null,
    };
  }, [plan.districts.length, opportunities, contacts, activitiesData, tasksData, vacanciesData]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0">
      {/* Tab strip */}
      <div className="shrink-0 border-b border-[#E2DEEC] flex items-center px-5 pt-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = tabCounts[tab.key];

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
        {activeTab === "vacancies" && <PlanVacanciesTab planId={plan.id} />}
      </div>
    </div>
  );
}

