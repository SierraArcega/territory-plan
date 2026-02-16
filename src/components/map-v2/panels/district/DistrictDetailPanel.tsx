"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import DistrictHeader from "./DistrictHeader";
import EnrollmentCard from "./EnrollmentCard";
import StaffingCard from "./StaffingCard";
import StudentPopulationsCard from "./StudentPopulationsCard";
import AcademicCard from "./AcademicCard";
import FinanceCard from "./FinanceCard";
import PurchasingHistoryCard from "./PurchasingHistoryCard";
import CompetitorSpendCard from "./CompetitorSpendCard";
import FullmindCard from "./FullmindCard";
import DistrictDetailsCard from "./DistrictDetailsCard";
import ContactsList from "./ContactsList";
import SignalCard from "./signals/SignalCard";

export default function DistrictDetailPanel() {
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data, isLoading, error } = useDistrictDetail(selectedLeaid);

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
            {/* Header with signal strip */}
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
              trends={data.trends}
            />

            {/* Signal Cards */}
            <div className="p-3 space-y-3">
              <PurchasingHistoryCard fullmindData={data.fullmindData} />

              <CompetitorSpendCard leaid={selectedLeaid!} />

              <FullmindCard data={data} leaid={selectedLeaid!} />

              <EnrollmentCard
                district={data.district}
                demographics={data.enrollmentDemographics}
                trends={data.trends}
              />

              <StaffingCard
                educationData={data.educationData}
                trends={data.trends}
              />

              <StudentPopulationsCard
                district={data.district}
                educationData={data.educationData}
                trends={data.trends}
              />

              <AcademicCard
                educationData={data.educationData}
                trends={data.trends}
              />

              <FinanceCard
                educationData={data.educationData}
                trends={data.trends}
              />

              <DistrictDetailsCard data={data} leaid={selectedLeaid!} />


              <SignalCard
                icon={
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                }
                title={`Contacts (${contacts.length})`}
                badge={<></>}
              >
                <ContactsList leaid={selectedLeaid!} contacts={contacts} />
              </SignalCard>
            </div>

            <p className="text-[10px] text-gray-300 text-center pt-1 pb-3">
              LEAID: {selectedLeaid}
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-5 bg-[#C4E7E6]/20 rounded w-4/5 mb-1 animate-pulse" />
        <div className="h-3 bg-[#C4E7E6]/15 rounded w-1/3 animate-pulse" />
      </div>
      <div className="flex gap-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 bg-[#C4E7E6]/20 rounded-full w-20 animate-pulse" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="border border-gray-100 rounded-xl p-3 animate-pulse space-y-2">
          <div className="flex justify-between">
            <div className="h-4 bg-[#C4E7E6]/20 rounded w-1/3" />
            <div className="h-4 bg-[#C4E7E6]/15 rounded-full w-16" />
          </div>
          <div className="h-7 bg-[#C4E7E6]/15 rounded w-1/2" />
          <div className="h-3 bg-[#C4E7E6]/10 rounded w-2/3" />
        </div>
      ))}
    </div>
  );
}
