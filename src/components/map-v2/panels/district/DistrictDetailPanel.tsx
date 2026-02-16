"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "./DistrictHeader";
import DistrictInfoTab from "./DistrictInfoTab";
import DataDemographicsTab from "./DataDemographicsTab";
import ContactsTab from "./ContactsTab";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DistrictSubTab = "info" | "data" | "contacts";

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DistrictDetailPanel() {
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data, isLoading, error } = useDistrictDetail(selectedLeaid);

  const [activeTab, setActiveTab] = useState<DistrictSubTab>("info");

  // Reset tab when district changes
  useEffect(() => {
    setActiveTab("info");
  }, [selectedLeaid]);

  const district = data?.district;
  const contacts = data?.contacts || [];

  return (
    <div className="flex flex-col h-full">
      {/* Back button header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
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
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          District
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-3">
            <LoadingSkeleton />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-sm text-red-400">
            Failed to load district details
          </div>
        ) : !district ? (
          <div className="text-center py-8 text-sm text-gray-400">
            District not found
          </div>
        ) : (
          <>
            {/* District header */}
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
            />

            {/* Tab bar */}
            <div className="flex border-b border-gray-100 px-1">
              <TabButton
                active={activeTab === "info"}
                onClick={() => setActiveTab("info")}
              >
                District Info
              </TabButton>
              <TabButton
                active={activeTab === "data"}
                onClick={() => setActiveTab("data")}
              >
                Data + Demographics
              </TabButton>
              <TabButton
                active={activeTab === "contacts"}
                onClick={() => setActiveTab("contacts")}
              >
                Contacts ({contacts.length})
              </TabButton>
            </div>

            {/* Tab content */}
            {activeTab === "info" && (
              <DistrictInfoTab data={data} leaid={selectedLeaid!} />
            )}
            {activeTab === "data" && (
              <DataDemographicsTab data={data} />
            )}
            {activeTab === "contacts" && (
              <ContactsTab leaid={selectedLeaid!} contacts={contacts} />
            )}

            <p className="text-[10px] text-gray-300 text-center pt-1 pb-3">
              LEAID: {selectedLeaid}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabButton
// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium transition-colors relative ${
        active ? "text-[#F37167]" : "text-gray-500 hover:text-[#403770]"
      }`}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-5 bg-gray-200 rounded w-4/5 mb-1 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
      </div>
      <div className="h-6 bg-plum/10 rounded-full w-28 animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
