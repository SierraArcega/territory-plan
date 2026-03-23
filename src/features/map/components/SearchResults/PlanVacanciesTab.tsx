"use client";

import { usePlanVacancies } from "@/features/vacancies/lib/queries";
import VacanciesTable from "@/features/vacancies/components/VacanciesTable";

interface PlanVacanciesTabProps {
  planId: string;
}

export default function PlanVacanciesTab({ planId }: PlanVacanciesTabProps) {
  const { data, isLoading } = usePlanVacancies(planId);
  const vacancies = data?.vacancies ?? [];

  if (isLoading) {
    return (
      <div className="p-5 space-y-3 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-[#f0edf5]">
            <div className="flex-1 space-y-1.5">
              <div className="h-3 bg-[#f0edf5] rounded w-2/5" />
              <div className="flex gap-2">
                <div className="h-2.5 bg-[#f0edf5] rounded w-16" />
                <div className="h-2.5 bg-[#f0edf5] rounded w-24" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (vacancies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-9 h-9 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No vacancies</p>
        <p className="text-xs text-[#A69DC0] mt-1">
          No open positions found across districts in this plan.
        </p>
      </div>
    );
  }

  return <VacanciesTable vacancies={vacancies} />;
}
