"use client";

import type { ExploreEntity } from "@/lib/map-v2-store";

interface KPICardProps {
  label: string;
  value: string;
  subtitle?: string;
  accent?: string;
}

function KPICard({ label, value, subtitle, accent = "#6EA3BE" }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />
      <div className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">{label}</div>
      <div className="text-xl font-bold text-[#403770] mt-1">{value}</div>
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

function gridColsClass(count: number): string {
  if (count <= 4) return "grid-cols-4";
  if (count === 5) return "grid-cols-5";
  if (count === 6) return "grid-cols-6";
  // 7+ cards: use a 4-column auto-flow grid so they wrap naturally
  return "grid-cols-4";
}

interface Props {
  entity: ExploreEntity;
  aggregates: Record<string, number> | undefined;
  isLoading: boolean;
}

export default function ExploreKPICards({ entity, aggregates, isLoading }: Props) {
  if (isLoading || !aggregates) {
    const count = entity === "plans" ? 7 : 4;
    return (
      <div className={`grid gap-4 ${gridColsClass(count)}`}>
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C4E7E6]/50" />
            <div className="h-3 w-16 bg-[#C4E7E6]/25 rounded animate-pulse mb-2" />
            <div className="h-5 w-20 bg-[#C4E7E6]/20 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const cards = getCardsForEntity(entity, aggregates);

  return (
    <div className={`grid gap-4 ${gridColsClass(cards.length)}`}>
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
        { label: "Districts", value: formatNumber(agg.count), accent: "#403770" },
        { label: "Total Enrollment", value: formatNumber(agg.enrollment_sum), subtitle: "students", accent: "#6EA3BE" },
        { label: "Open Pipeline", value: formatCurrency(agg.pipeline_sum), accent: "#FFCF70" },
        { label: "Closed Won", value: formatCurrency(agg.closed_won_sum), accent: "#8AA891" },
      ];
    case "activities":
      return [
        { label: "Total Activities", value: formatNumber(agg.count), accent: "#403770" },
        { label: "Completed", value: formatNumber(agg.completed), accent: "#8AA891" },
        { label: "Positive Outcomes", value: formatNumber(agg.positiveOutcomes), accent: "#EDFFE3" },
        { label: "Districts Touched", value: formatNumber(agg.districtsTouched), accent: "#6EA3BE" },
      ];
    case "tasks":
      return [
        { label: "Total Tasks", value: formatNumber(agg.count), accent: "#403770" },
        { label: "Overdue", value: formatNumber(agg.overdue), accent: "#F37167" },
        { label: "Completed", value: formatNumber(agg.completed), accent: "#8AA891" },
        { label: "Blocked", value: formatNumber(agg.blocked), accent: "#FFCF70" },
      ];
    case "contacts":
      return [
        { label: "Total Contacts", value: formatNumber(agg.count), accent: "#403770" },
        { label: "Districts Covered", value: formatNumber(agg.districtsCovered), accent: "#6EA3BE" },
        { label: "Primary Contacts", value: formatNumber(agg.primaryCount), accent: "#C4E7E6" },
        { label: "Recently Active", value: formatNumber(agg.withRecentActivity), accent: "#8AA891" },
      ];
    case "plans": {
      const totalTargets = (agg.renewalSum || 0) + (agg.expansionSum || 0) + (agg.winbackSum || 0) + (agg.newBusinessSum || 0);
      return [
        { label: "Total Districts", value: formatNumber(agg.totalDistricts), accent: "#403770" },
        { label: "Total Targets", value: formatCurrency(totalTargets || null), accent: "#403770" },
        { label: "FY27 Pipeline", value: formatCurrency(agg.fy27PipelineSum), accent: "#F37167" },
        { label: "Renewal Rollup", value: formatCurrency(agg.renewalSum), accent: "#6EA3BE" },
        { label: "Expansion Rollup", value: formatCurrency(agg.expansionSum), accent: "#8AA891" },
        { label: "Win Back Rollup", value: formatCurrency(agg.winbackSum), accent: "#FFCF70" },
        { label: "New Business Rollup", value: formatCurrency(agg.newBusinessSum), accent: "#C4E7E6" },
      ];
    }
  }
}
