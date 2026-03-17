"use client";

import { useQuery } from "@tanstack/react-query";
import SignalCard from "@/features/map/components/panels/district/signals/SignalCard";
import VacancyList from "./VacancyList";

interface VacanciesCardProps {
  leaid: string;
}

interface VacancySummary {
  totalOpen: number;
  fullmindRelevant: number;
  byCategory: Record<string, number>;
  lastScannedAt: string | null;
}

interface VacanciesResponse {
  summary: VacancySummary;
  vacancies: unknown[];
}

export default function VacanciesCard({ leaid }: VacanciesCardProps) {
  // Use the same query key as VacancyList so data is shared
  const { data } = useQuery<VacanciesResponse>({
    queryKey: ["vacancies", leaid],
    queryFn: async () => {
      const res = await fetch(`/api/districts/${leaid}/vacancies`);
      if (!res.ok) throw new Error("Failed to fetch vacancies");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const totalOpen = data?.summary.totalOpen ?? 0;
  const fullmindRelevant = data?.summary.fullmindRelevant ?? 0;

  return (
    <SignalCard
      icon={
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      }
      title="Job Vacancies"
      badge={
        totalOpen > 0 ? (
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#6EA3BE]/15 text-[#4a7a90]">
            {totalOpen} open
            {fullmindRelevant > 0 && (
              <span className="ml-1 text-[#9b4840]">
                ({fullmindRelevant} relevant)
              </span>
            )}
          </span>
        ) : (
          <></>
        )
      }
    >
      <VacancyList leaid={leaid} />
    </SignalCard>
  );
}
