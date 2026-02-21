"use client";

import { useState, useEffect } from "react";
import { useDistrictDetail, useStateDetail, useSchoolsByDistrict } from "@/lib/api";
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
import TaskList from "@/features/tasks/components/TaskList";
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

// School level labels
const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Primary",
  2: "Middle",
  3: "High",
  4: "Other",
};

// Charter Schools section for District Info tab
function CharterSchoolsSection({ leaid }: { leaid: string }) {
  const { data, isLoading } = useSchoolsByDistrict(leaid);
  const openSchoolPanel = useMapStore((s) => s.openSchoolPanel);

  const charterSchools = data?.schools.filter((s) => s.charter === 1) || [];

  if (isLoading) {
    return (
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Charter Schools
        </h3>
        <div className="animate-pulse h-8 bg-gray-100 rounded" />
      </div>
    );
  }

  if (charterSchools.length === 0) return null;

  const totalCharterEnrollment = charterSchools.reduce(
    (sum, s) => sum + (s.enrollment || 0),
    0
  );

  return (
    <div className="px-6 py-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Charter Schools
        </h3>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#F37167]/10 text-[#F37167]">
          {charterSchools.length}
        </span>
      </div>
      {totalCharterEnrollment > 0 && (
        <p className="text-xs text-gray-500 mb-2">
          Total charter enrollment: {totalCharterEnrollment.toLocaleString()}
        </p>
      )}
      <div className="space-y-1">
        {charterSchools.slice(0, 10).map((school) => (
          <button
            key={school.ncessch}
            onClick={() => openSchoolPanel(school.ncessch)}
            className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors text-left group"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 truncate group-hover:text-[#F37167]">
                {school.schoolName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {school.schoolLevel && SCHOOL_LEVEL_LABELS[school.schoolLevel] && (
                  <span>{SCHOOL_LEVEL_LABELS[school.schoolLevel]}</span>
                )}
                {school.lograde && school.higrade && (
                  <span>Grades {school.lograde}-{school.higrade}</span>
                )}
              </div>
            </div>
            <div className="text-right ml-2 shrink-0">
              {school.enrollment != null && (
                <span className="text-sm font-medium text-gray-700">
                  {school.enrollment.toLocaleString()}
                </span>
              )}
              {/* Mini sparkline for enrollment trend */}
              {school.enrollmentHistory && school.enrollmentHistory.length > 1 && (
                <MiniSparkline data={school.enrollmentHistory} />
              )}
            </div>
          </button>
        ))}
        {charterSchools.length > 10 && (
          <p className="text-xs text-gray-400 text-center pt-1">
            +{charterSchools.length - 10} more
          </p>
        )}
      </div>
    </div>
  );
}

// Tiny sparkline for enrollment trend
function MiniSparkline({
  data,
}: {
  data: { year: number; enrollment: number | null }[];
}) {
  const values = data
    .filter((d) => d.enrollment != null)
    .map((d) => d.enrollment!);
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const width = 40;
  const height = 16;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const trend = values[values.length - 1] - values[0];
  const color = trend >= 0 ? "#22C55E" : "#EF4444";

  return (
    <svg width={width} height={height} className="mt-0.5">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
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

      {/* Charter Schools Section */}
      <CharterSchoolsSection leaid={leaid} />

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

      {/* Tasks linked to this district */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tasks</h3>
        <TaskList leaid={leaid} compact />
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
