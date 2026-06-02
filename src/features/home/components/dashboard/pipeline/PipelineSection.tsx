"use client";

import { usePipeline } from "@/features/home/lib/queries";
import CoverageCard from "./CoverageCard";
import StageHealthCard from "./StageHealthCard";
import FunnelCard from "./FunnelCard";
import TopOpportunitiesTable from "./TopOpportunitiesTable";
import AtRiskCard from "./AtRiskCard";
import ThisWeekCard from "./ThisWeekCard";
import TopTargetsCard from "./TopTargetsCard";

// Pipeline tab body — owns the pipeline query and lays out its cards.
export default function PipelineSection({ fy }: { fy: number }) {
  const { data, isLoading, isError, refetch } = usePipeline(fy);

  if (isError) {
    return (
      <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
        <p className="text-sm text-[#5C5378]">Couldn&apos;t load your pipeline.</p>
        <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-[#F37167] hover:underline">
          Retry
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-5">
        <div className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />
        <div className="h-[200px] rounded-lg border border-[#D4CFE2] bg-[#F7F5FA] animate-pulse" />
      </div>
    );
  }

  if (!data.inRoster) {
    return (
      <div className="rounded-lg border border-[#D4CFE2] bg-white shadow-sm p-6 text-center">
        <h3 className="text-sm font-bold text-[#403770] whitespace-nowrap">Pipeline</h3>
        <p className="mt-2 text-sm text-[#8A80A8]">
          You&apos;re not a ranked sales rep — the pipeline is scoped to reps. Impersonate a rep to see their book.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col gap-5">
        <CoverageCard coverage={data.coverage} />
        <FunnelCard opps={data.opps} />
        <StageHealthCard stageHealth={data.stageHealth} />
        <TopOpportunitiesTable opps={data.opps} />
        <TopTargetsCard />
      </div>
      {/* Right rail (stacks under the main column when narrow) */}
      <div className="flex w-full shrink-0 flex-col gap-5 lg:w-[320px]">
        {data.thisWeek && <ThisWeekCard thisWeek={data.thisWeek} />}
        <AtRiskCard atRisk={data.atRisk} />
      </div>
    </div>
  );
}
