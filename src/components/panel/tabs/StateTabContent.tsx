"use client";

import { useStateDetail } from "@/lib/api";
import StateHeader from "../state/StateHeader";
import StateStats from "../state/StateStats";
import StateDistrictsList from "../state/StateDistrictsList";
import StateNotesEditor from "../state/StateNotesEditor";
import { useState } from "react";

interface StateTabContentProps {
  stateCode: string | null;
}

type SubTab = "overview" | "districts";

export default function StateTabContent({ stateCode }: StateTabContentProps) {
  const [subTab, setSubTab] = useState<SubTab>("overview");
  const { data, isLoading, error } = useStateDetail(stateCode);

  if (!stateCode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <svg
          className="w-16 h-16 text-gray-200 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
          />
        </svg>
        <p className="text-gray-500 font-medium">No state selected</p>
        <p className="text-gray-400 text-sm mt-1">
          Click on a state in the map to view details
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading state</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* State Header */}
      <StateHeader state={data} />

      {/* Sub-tabs for Overview vs Districts list */}
      <div className="flex border-b border-gray-100 px-4 bg-gray-50/50">
        {(
          [
            { id: "overview", label: "Overview" },
            { id: "districts", label: `Districts (${data.aggregates.totalDistricts})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-4 py-2 text-xs font-medium transition-colors relative ${
              subTab === tab.id
                ? "text-[#403770]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
            {subTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#403770]" />
            )}
          </button>
        ))}
      </div>

      {/* Sub-tab content */}
      <div className="flex-1 overflow-hidden">
        {subTab === "overview" ? (
          <div className="h-full overflow-y-auto">
            <StateStats state={data} />
            <StateNotesEditor
              stateCode={data.code}
              notes={data.notes}
            />
          </div>
        ) : (
          <StateDistrictsList stateCode={data.code} />
        )}
      </div>
    </div>
  );
}
