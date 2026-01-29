"use client";

import { useMapStore } from "@/lib/store";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "./DistrictHeader";
import DistrictInfo from "./DistrictInfo";
import FinanceData from "./FinanceData";
import StaffingSalaries from "./StaffingSalaries";
import DemographicsChart from "./DemographicsChart";
import AcademicMetrics from "./AcademicMetrics";
import StudentPopulations from "./StudentPopulations";
import MetricsChart from "./MetricsChart";
import PipelineSummary from "./PipelineSummary";
import NotesEditor from "./NotesEditor";
import TagsEditor from "./TagsEditor";
import ContactsList from "./ContactsList";

export default function SidePanel() {
  const { selectedLeaid, sidePanelOpen, setSidePanelOpen } = useMapStore();
  const { data, isLoading, error } = useDistrictDetail(selectedLeaid);

  if (!sidePanelOpen || !selectedLeaid) {
    return null;
  }

  return (
    <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-xl z-20 flex flex-col overflow-hidden">
      {/* Close button */}
      <button
        onClick={() => setSidePanelOpen(false)}
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
            <p className="font-medium">Error loading district</p>
            <p className="text-sm mt-1">{error.message}</p>
          </div>
        </div>
      ) : data ? (
        <div className="flex-1 overflow-y-auto">
          {/* Group 1: Identity */}
          <DistrictHeader
            district={data.district}
            fullmindData={data.fullmindData}
          />
          <DistrictInfo district={data.district} />

          {/* Group 2: Student Body */}
          {data.enrollmentDemographics && (
            <DemographicsChart demographics={data.enrollmentDemographics} />
          )}
          <StudentPopulations
            district={data.district}
            educationData={data.educationData}
          />
          {data.educationData && (
            <AcademicMetrics educationData={data.educationData} />
          )}

          {/* Group 3: Financial */}
          {data.educationData && (
            <FinanceData educationData={data.educationData} />
          )}
          {data.educationData && (
            <StaffingSalaries educationData={data.educationData} />
          )}

          {/* Group 4: Sales/CRM */}
          {data.fullmindData && (
            <div className="px-6 py-4 border-b border-gray-100">
              <MetricsChart fullmindData={data.fullmindData} />
            </div>
          )}
          {data.fullmindData && (
            <div className="px-6 py-4 border-b border-gray-100">
              <PipelineSummary fullmindData={data.fullmindData} />
            </div>
          )}
          <div className="px-6 py-4 border-b border-gray-100">
            <TagsEditor leaid={selectedLeaid} tags={data.tags} />
          </div>
          <div className="px-6 py-4 border-b border-gray-100">
            <NotesEditor leaid={selectedLeaid} edits={data.edits} />
          </div>
          <div className="px-6 py-4">
            <ContactsList leaid={selectedLeaid} contacts={data.contacts} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
