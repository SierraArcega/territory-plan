"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail, useRemoveDistrictFromPlan } from "@/lib/api";
import DistrictHeader from "../panels/district/DistrictHeader";
import DistrictTabStrip, { type DistrictTab } from "../panels/district/tabs/DistrictTabStrip";
import PlanningTab from "../panels/district/tabs/PlanningTab";
import SignalsTab from "../panels/district/tabs/SignalsTab";
import SchoolsTab from "../panels/district/tabs/SchoolsTab";
import ContactsTab from "../panels/district/ContactsTab";

export default function DistrictCard({ leaid }: { leaid: string }) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const { data, isLoading, error } = useDistrictDetail(leaid);
  const removeMutation = useRemoveDistrictFromPlan();

  const [activeTab, setActiveTab] = useState<DistrictTab>("planning");
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  // Reset tab when district changes; non-district accounts skip the signals tab
  useEffect(() => {
    const accountType = data?.district?.accountType;
    const isNonDistrict = accountType && accountType !== "district";
    setActiveTab(isNonDistrict ? "contacts" : "planning");
    setShowRemoveConfirm(false);
  }, [leaid, data?.district?.accountType]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error || !data) {
    return (
      <div className="text-center py-8 text-xs text-gray-400">
        District not found
      </div>
    );
  }

  const contacts = data.contacts || [];

  const handleRemove = () => {
    if (!activePlanId) return;
    removeMutation.mutate(
      { planId: activePlanId, leaid },
      {
        onSuccess: () => {
          setShowRemoveConfirm(false);
          closeRightPanel();
        },
      }
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* District header */}
      <DistrictHeader
        district={data.district}
        fullmindData={data.fullmindData}
        tags={data.tags}
        trends={data.trends}
      />

      {/* Tab strip */}
      <DistrictTabStrip
        activeTab={activeTab}
        onSelect={setActiveTab}
        contactCount={contacts.length}
        showPlanning={!!activePlanId}
        showSignals={data.district.accountType === "district" || !data.district.accountType}
      />

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {activeTab === "planning" && (
          <PlanningTab data={data} leaid={leaid} />
        )}
        {activeTab === "signals" && (
          <SignalsTab data={data} leaid={leaid} />
        )}
        {activeTab === "schools" && (
          <SchoolsTab leaid={leaid} />
        )}
        {activeTab === "contacts" && (
          <ContactsTab leaid={leaid} contacts={contacts} />
        )}
      </div>

      {/* Plan actions footer */}
      {activePlanId && (
        <div className="border-t border-gray-100 px-3 py-2 space-y-1.5">
          <button
            onClick={() => openRightPanel({ type: "task_form", id: leaid })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-gray-400">
              <path
                d="M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Add Task
          </button>

          <button
            onClick={() => openRightPanel({ type: "activity_form", id: leaid })}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 transition-colors text-xs font-medium text-gray-600"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0 text-gray-400">
              <path
                d="M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M8 14C11.3 14 14 11.3 14 8S11.3 2 8 2 2 4.7 2 8 4.7 14 8 14Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Add Activity
          </button>

          {!showRemoveConfirm ? (
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-red-500 hover:bg-red-50 transition-colors text-xs font-medium"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="shrink-0">
                <path
                  d="M3 5H13M5 5V3C5 2.4 5.4 2 6 2H10C10.6 2 11 2.4 11 3V5M6 8V12M10 8V12M4 5L5 14H11L12 5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Remove from Plan
            </button>
          ) : (
            <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 space-y-2">
              <p className="text-xs text-red-600 font-medium">
                Remove from plan?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleRemove}
                  disabled={removeMutation.isPending}
                  className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {removeMutation.isPending ? "Removing..." : "Remove"}
                </button>
                <button
                  onClick={() => setShowRemoveConfirm(false)}
                  className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <p className="text-[10px] text-gray-300 text-center pb-2">
        {data.district.accountType && data.district.accountType !== "district" ? "Account ID" : "LEAID"}: {leaid}
      </p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-3">
      <div>
        <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mt-1.5 animate-pulse" />
      </div>
      <div className="h-5 bg-plum/10 rounded-full w-20 animate-pulse" />
      <div className="grid grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg bg-gray-50 p-2 animate-pulse">
            <div className="h-2 bg-gray-200 rounded w-2/3 mb-1.5" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
