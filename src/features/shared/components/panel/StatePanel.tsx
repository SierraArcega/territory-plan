"use client";

import { useState } from "react";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useStateDetail } from "@/lib/api";
import StateHeader from "./state/StateHeader";
import StateStats from "./state/StateStats";
import StateDistrictsList from "./state/StateDistrictsList";
import StatePlans from "./state/StatePlans";
import StateNotesEditor from "./state/StateNotesEditor";

type TabType = "stats" | "districts" | "plans";

export default function StatePanel() {
  const { selectedStateCode, closePanel } = useMapStore();
  const [activeTab, setActiveTab] = useState<TabType>("stats");
  const { data, isLoading, error } = useStateDetail(selectedStateCode);

  if (!selectedStateCode) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl z-20 flex flex-col overflow-hidden">
      {/* Close button */}
      <button
        onClick={closePanel}
        className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-[#403770] z-10"
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

      {/* Content */}
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center text-red-500">
            <p className="font-medium">Error loading state</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      ) : data ? (
        <>
          {/* Header */}
          <StateHeader state={data} />

          {/* Tabs */}
          <div className="flex border-b border-gray-200 px-2">
            {(
              [
                { id: "stats", label: "Stats", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
                { id: "districts", label: "Districts", icon: "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" },
                { id: "plans", label: "Plans", icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? "text-[#403770]"
                    : "text-gray-500 hover:text-gray-700"
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
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === "stats" && (
              <div className="flex-1 overflow-y-auto">
                <StateStats state={data} />
                <StateNotesEditor
                  stateCode={data.code}
                  notes={data.notes}
                />
              </div>
            )}

            {activeTab === "districts" && (
              <StateDistrictsList stateCode={data.code} />
            )}

            {activeTab === "plans" && (
              <div className="flex-1 overflow-y-auto">
                <StatePlans plans={data.territoryPlans} />
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
