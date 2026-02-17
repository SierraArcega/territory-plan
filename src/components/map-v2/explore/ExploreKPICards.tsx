"use client";

import type { ExploreEntity } from "@/lib/map-v2-store";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
}

function KPICard({ label, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3">
      <div className="text-[11px] text-gray-500 font-medium uppercase tracking-wider">{label}</div>
      <div className="text-xl font-semibold text-gray-900 mt-0.5">{value}</div>
      {subtitle && <div className="text-[11px] text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "\u2014";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

interface Props {
  entity: ExploreEntity;
  aggregates: Record<string, number> | undefined;
  isLoading: boolean;
}

export default function ExploreKPICards({ entity, aggregates, isLoading }: Props) {
  if (isLoading || !aggregates) {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-3 h-[68px]">
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
            <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const cards = getCardsForEntity(entity, aggregates);

  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map((card) => (
        <KPICard key={card.label} {...card} />
      ))}
    </div>
  );
}

function getCardsForEntity(entity: ExploreEntity, agg: Record<string, number>): KPICardProps[] {
  switch (entity) {
    case "districts":
      return [
        { label: "Districts", value: formatNumber(agg.count) },
        { label: "Total Enrollment", value: formatNumber(agg.enrollment_sum), subtitle: "students" },
        { label: "Open Pipeline", value: formatCurrency(agg.pipeline_sum) },
        { label: "Closed Won", value: formatCurrency(agg.closed_won_sum) },
      ];
    case "activities":
      return [
        { label: "Total Activities", value: formatNumber(agg.count) },
        { label: "Completed", value: formatNumber(agg.completed) },
        { label: "Positive Outcomes", value: formatNumber(agg.positiveOutcomes) },
        { label: "Districts Touched", value: formatNumber(agg.districtsTouched) },
      ];
    case "tasks":
      return [
        { label: "Total Tasks", value: formatNumber(agg.count) },
        { label: "Overdue", value: formatNumber(agg.overdue) },
        { label: "Completed", value: formatNumber(agg.completed) },
        { label: "Blocked", value: formatNumber(agg.blocked) },
      ];
    case "contacts":
      return [
        { label: "Total Contacts", value: formatNumber(agg.count) },
        { label: "Districts Covered", value: formatNumber(agg.districtsCovered) },
        { label: "Primary Contacts", value: formatNumber(agg.primaryCount) },
        { label: "Recently Active", value: formatNumber(agg.withRecentActivity) },
      ];
  }
}
