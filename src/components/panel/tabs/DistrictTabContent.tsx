"use client";

import { useState, useEffect } from "react";
import { useDistrictDetail, useStateDetail } from "@/lib/api";
import { useMapStore } from "@/lib/store";
import StateDistrictsList from "../state/StateDistrictsList";
import DistrictHeader from "../DistrictHeader";
import AddToPlanButton from "../AddToPlanButton";
import DistrictInfo from "../DistrictInfo";
import FindSimilarDistricts from "../FindSimilarDistricts";
import FinanceData from "../FinanceData";
import StaffingSalaries from "../StaffingSalaries";
import DemographicsChart from "../DemographicsChart";
import AcademicMetrics from "../AcademicMetrics";
import StudentPopulations from "../StudentPopulations";
import FullmindMetrics from "../FullmindMetrics";
import CompetitorSpend from "../CompetitorSpend";
import NotesEditor from "../NotesEditor";
import TagsEditor from "../TagsEditor";
import ContactsList from "../ContactsList";
import type { DistrictDetail } from "@/lib/api";

type DistrictSubTab = "info" | "data" | "contacts";

interface DistrictTabContentProps {
  leaid: string | null;
  stateCode: string | null;
}

// Tab button component
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
        active
          ? "text-[#F37167]"
          : "text-gray-500 hover:text-[#403770]"
      }`}
    >
      {children}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
      )}
    </button>
  );
}

// Sub-tabs bar component
function DistrictSubTabs({
  activeTab,
  onTabChange,
  contactsCount,
}: {
  activeTab: DistrictSubTab;
  onTabChange: (tab: DistrictSubTab) => void;
  contactsCount: number;
}) {
  return (
    <div className="flex border-b border-gray-200 bg-white px-2">
      <TabButton
        active={activeTab === "info"}
        onClick={() => onTabChange("info")}
      >
        District Info
      </TabButton>
      <TabButton
        active={activeTab === "data"}
        onClick={() => onTabChange("data")}
      >
        Data + Demographics
      </TabButton>
      <TabButton
        active={activeTab === "contacts"}
        onClick={() => onTabChange("contacts")}
      >
        Contacts ({contactsCount})
      </TabButton>
    </div>
  );
}

// Tab 1: District Info content
function DistrictInfoTab({
  data,
  leaid,
}: {
  data: DistrictDetail;
  leaid: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Fullmind Data */}
      {data.fullmindData && (
        <FullmindMetrics fullmindData={data.fullmindData} />
      )}

      {/* Competitor Spend */}
      <CompetitorSpend leaid={leaid} />

      {/* Action Buttons */}
      <div className="px-6 py-3 border-b border-gray-100 bg-gray-50/50 flex gap-2">
        <AddToPlanButton
          leaid={leaid}
          existingPlanIds={data.territoryPlanIds}
        />
        <FindSimilarDistricts
          district={data.district}
          educationData={data.educationData}
          enrollmentDemographics={data.enrollmentDemographics}
        />
      </div>

      {/* District Info */}
      <DistrictInfo district={data.district} />

      {/* Tags Editor */}
      <div className="px-6 py-4 border-b border-gray-100">
        <TagsEditor leaid={leaid} tags={data.tags} />
      </div>

      {/* Notes Editor */}
      <div className="px-6 py-4 border-b border-gray-100">
        <NotesEditor leaid={leaid} edits={data.edits} />
      </div>
    </div>
  );
}

// Tab 2: Data + Demographics content
function DataDemographicsTab({ data }: { data: DistrictDetail }) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Demographics Chart */}
      {data.enrollmentDemographics && (
        <DemographicsChart demographics={data.enrollmentDemographics} />
      )}

      {/* Student Populations */}
      <StudentPopulations
        district={data.district}
        educationData={data.educationData}
      />

      {/* Academic Metrics */}
      {data.educationData && (
        <AcademicMetrics educationData={data.educationData} />
      )}

      {/* Finance Data */}
      {data.educationData && (
        <FinanceData educationData={data.educationData} />
      )}

      {/* Staffing/Salaries */}
      {data.educationData && (
        <StaffingSalaries educationData={data.educationData} />
      )}
    </div>
  );
}

// Tab 3: Contacts content
function ContactsTab({
  leaid,
  contacts,
}: {
  leaid: string;
  contacts: DistrictDetail["contacts"];
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-6 py-4">
        <ContactsList leaid={leaid} contacts={contacts} />
      </div>
    </div>
  );
}

export default function DistrictTabContent({ leaid, stateCode }: DistrictTabContentProps) {
  const [activeSubTab, setActiveSubTab] = useState<DistrictSubTab>("info");
  const { data, isLoading, error } = useDistrictDetail(leaid);
  const goBackToDistrictsList = useMapStore((s) => s.goBackToDistrictsList);

  // Get state name for back link - must be called unconditionally (hooks rule)
  const districtStateAbbrev = data?.district.stateAbbrev || stateCode;
  const { data: stateData } = useStateDetail(districtStateAbbrev);

  // Reset to "info" tab when switching districts
  useEffect(() => {
    setActiveSubTab("info");
  }, [leaid]);

  // Case 1: No leaid and no stateCode - show empty state
  if (!leaid && !stateCode) {
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
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <p className="text-gray-500 font-medium">No district selected</p>
        <p className="text-gray-400 text-sm mt-1">
          Click on a district in the map to view details
        </p>
      </div>
    );
  }

  // Case 2: No leaid but have stateCode - show districts list
  if (!leaid && stateCode) {
    return (
      <div className="flex flex-col h-full">
        <StateDistrictsList stateCode={stateCode} />
      </div>
    );
  }

  // Case 3: Have leaid - show district detail
  // TypeScript narrowing: at this point leaid must be non-null
  if (!leaid) {
    return null;
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
          <p className="font-medium">Error loading district</p>
          <p className="text-sm mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Back to state districts link - only show if we have state context */}
      {stateCode && (
        <button
          onClick={goBackToDistrictsList}
          className="flex items-center gap-1 px-6 py-2 text-sm text-[#403770] hover:text-[#F37167] bg-gray-50 border-b border-gray-100 w-full"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to {stateData?.name || stateCode} districts
        </button>
      )}

      {/* District Header - always visible */}
      <DistrictHeader
        district={data.district}
        fullmindData={data.fullmindData}
        tags={data.tags}
      />

      {/* Tab bar - fixed below header */}
      <DistrictSubTabs
        activeTab={activeSubTab}
        onTabChange={setActiveSubTab}
        contactsCount={data.contacts.length}
      />

      {/* Tab content - scrolls independently */}
      {activeSubTab === "info" && (
        <DistrictInfoTab data={data} leaid={leaid} />
      )}
      {activeSubTab === "data" && (
        <DataDemographicsTab data={data} />
      )}
      {activeSubTab === "contacts" && (
        <ContactsTab leaid={leaid} contacts={data.contacts} />
      )}
    </div>
  );
}
