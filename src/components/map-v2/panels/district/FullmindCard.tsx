"use client";

import type { DistrictDetail } from "@/lib/api";
import AddToPlanButton from "./AddToPlanButton";
import FindSimilarDistricts from "./FindSimilarDistricts";
import SignalCard from "./signals/SignalCard";

interface FullmindCardProps {
  data: DistrictDetail;
  leaid: string;
}

export default function FullmindCard({ data, leaid }: FullmindCardProps) {
  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0" />
        </svg>
      }
      title="Territory Planning"
      badge={
        data.fullmindData?.isCustomer ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b]">
            Customer
          </span>
        ) : data.fullmindData?.hasOpenPipeline ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FFCF70]/20 text-[#997c43]">
            Pipeline
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#6EA3BE]/15 text-[#4d7285]">
            Prospect
          </span>
        )
      }
    >
      <div className="space-y-3">
        {data.fullmindData?.salesExecutive && (
          <div className="text-xs text-gray-500">
            SE: <span className="font-medium text-[#403770]">{data.fullmindData.salesExecutive}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <AddToPlanButton leaid={leaid} existingPlanIds={data.territoryPlanIds} />
          <FindSimilarDistricts
            district={data.district}
            educationData={data.educationData}
            enrollmentDemographics={data.enrollmentDemographics}
          />
        </div>
      </div>
    </SignalCard>
  );
}
