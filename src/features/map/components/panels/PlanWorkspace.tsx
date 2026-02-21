"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import type { PlanSection } from "@/features/map/lib/store";
import { useTerritoryPlan } from "@/lib/api";
import PlanOverviewSection from "./PlanOverviewSection";
import PlanTasksSection from "./PlanTasksSection";
import PlanContactsSection from "./PlanContactsSection";
import PlanPerfSection from "./PlanPerfSection";
import PlanActivitiesSection from "./PlanActivitiesSection";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  planning: { bg: "bg-gray-100", text: "text-gray-600" },
  working: { bg: "bg-green-100", text: "text-green-700" },
  stale: { bg: "bg-amber-100", text: "text-amber-700" },
  archived: { bg: "bg-gray-200", text: "text-gray-500" },
};

const ICON_TABS: { key: PlanSection; label: string; path: string; stroke?: boolean }[] = [
  {
    key: "districts",
    label: "Districts",
    path: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z",
    stroke: false,
  },
  {
    key: "activities",
    label: "Activities",
    path: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M8 14C11.3 14 14 11.3 14 8S11.3 2 8 2 2 4.7 2 8 4.7 14 8 14Z",
    stroke: true,
  },
  {
    key: "tasks",
    label: "Tasks",
    path: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13",
    stroke: true,
  },
  {
    key: "contacts",
    label: "Contacts",
    path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
    stroke: true,
  },
  {
    key: "performance",
    label: "Performance",
    path: "M3 13V8M7 13V5M11 13V9M15 13V3",
    stroke: true,
  },
];

export default function PlanWorkspace() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const planSection = useMapV2Store((s) => s.planSection);
  const setPlanSection = useMapV2Store((s) => s.setPlanSection);
  const goBack = useMapV2Store((s) => s.goBack);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);

  const badge = plan ? STATUS_BADGE[plan.status] || STATUS_BADGE.planning : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={goBack}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="#6B7280"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isLoading ? (
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            </div>
          ) : plan ? (
            <>
              <h2 className="text-sm font-semibold text-gray-800 truncate flex-1">
                {plan.name}
              </h2>
              {/* Edit plan — opens in right panel */}
              <button
                onClick={() => openRightPanel({ type: "plan_edit" })}
                className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
                aria-label="Edit plan"
                title="Edit plan"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.5 2.5L13.5 4.5M10 4L2 12V14H4L12 6L10 4Z"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-400">Plan not found</span>
          )}
        </div>

        {/* Badges */}
        {isLoading ? (
          <div className="flex gap-1.5 mb-2 ml-9">
            <div className="h-5 bg-gray-100 rounded-full w-14 animate-pulse" />
            <div className="h-5 bg-plum/10 rounded-full w-12 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded-full w-20 animate-pulse" />
          </div>
        ) : plan ? (
          <div className="flex gap-1.5 flex-wrap ml-9 mb-2">
            {badge && (
              <span
                className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text} capitalize`}
              >
                {plan.status}
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/10 text-plum">
              FY {plan.fiscalYear}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
              {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
            </span>
            {plan.states?.map((s) => (
              <span
                key={s.fips}
                className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-blue-50 text-blue-700"
              >
                {s.abbrev}
              </span>
            ))}
            {plan.owner && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
                {plan.owner.fullName}
              </span>
            )}
            {plan.collaborators && plan.collaborators.length > 0 && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-purple-50 text-purple-700">
                +{plan.collaborators.length} collaborator{plan.collaborators.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        ) : null}
      </div>

      {/* Icon strip */}
      <PlanIconStrip activeSection={planSection} onSelect={setPlanSection} />

      {/* Section content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {planSection === "districts" && <PlanOverviewSection />}
        {planSection === "activities" && <PlanActivitiesSection />}
        {planSection === "tasks" && <PlanTasksSection />}
        {planSection === "contacts" && <PlanContactsSection />}
        {planSection === "performance" && <PlanPerfSection />}
      </div>
    </div>
  );
}

function PlanIconStrip({
  activeSection,
  onSelect,
}: {
  activeSection: PlanSection;
  onSelect: (section: PlanSection) => void;
}) {
  return (
    <div className="flex border-b border-gray-100">
      {ICON_TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <path
                d={tab.path}
                stroke={isActive ? "currentColor" : "currentColor"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={tab.stroke ? "none" : "currentColor"}
              />
            </svg>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
