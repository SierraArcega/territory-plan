"use client";

import { X, Plus } from "lucide-react";
import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";
import { getFinancial } from "@/features/shared/lib/financial-helpers";
import type { DistrictFinancial } from "@/features/shared/types/api-types";

interface DistrictCardData {
  leaid: string;
  name: string;
  stateAbbrev: string;
  countyName: string | null;
  enrollment: number | null;
  isCustomer: boolean | null;
  accountType: string | null;
  ownerUser: { id: string; fullName: string; avatarUrl: string | null } | null;
  ellPct: number | null;
  swdPct: number | null;
  childrenPovertyPercent: number | null;
  medianHouseholdIncome: number | null;
  expenditurePerPupil: number | null;
  urbanCentricLocale: number | null;
  districtFinancials: DistrictFinancial[];
  territoryPlans: Array<{ plan: { id: string; name: string; color: string } }>;
}

interface DistrictSearchCardProps {
  district: DistrictCardData;
  isSelected: boolean;
  onToggleSelect: () => void;
  onExplore: (leaid: string) => void;
  activeFilters: ExploreFilter[];
}

export default function DistrictSearchCard({
  district,
  isSelected,
  onToggleSelect,
  onExplore,
  activeFilters,
}: DistrictSearchCardProps) {
  const setHoveredLeaid = useMapV2Store((s) => s.setHoveredLeaid);

  const handleClick = () => {
    onExplore(district.leaid);
  };

  // Determine which adaptive metrics to show based on active filters
  const adaptiveMetrics = getAdaptiveMetrics(district, activeFilters);

  return (
    <div
      className={`group relative px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? "bg-[#e8f1f5] border-[#6EA3BE]/30 ring-1 ring-[#6EA3BE]/20" : "border-[#E2DEEC] hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      }`}
      onClick={handleClick}
      onMouseEnter={() => setHoveredLeaid(district.leaid)}
      onMouseLeave={() => setHoveredLeaid(null)}
      data-testid="district-card"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        className={`absolute top-2 right-2 w-[18px] h-[18px] rounded-full flex items-center justify-center transition-colors ${
          isSelected
            ? "text-plum/50 bg-plum/10 hover:bg-red-50 hover:text-red-500"
            : "text-plum/40 bg-plum/8 hover:bg-[#e8f1f5] hover:text-[#6EA3BE]"
        }`}
        title={isSelected ? "Remove" : "Add to selection"}
        aria-label={isSelected ? "Remove district" : "Add district to selection"}
      >
        {isSelected ? <X size={10} strokeWidth={2.5} /> : <Plus size={10} strokeWidth={2.5} />}
      </button>
      <div className="pr-6">
        {/* Header: Name + Badge */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold text-[#544A78] truncate">{district.name}</h4>
            <p className="text-xs text-[#8A80A8]">
              {district.stateAbbrev}
              {district.countyName && ` · ${district.countyName}`}
            </p>
          </div>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
            district.isCustomer
              ? "bg-[#8AA891]/15 text-[#5a7a61]"
              : "bg-[#F7F5FA] text-[#8A80A8]"
          }`}>
            {district.isCustomer ? "Customer" : "Prospect"}
          </span>
        </div>

        {/* Fixed metrics row */}
        <div className="flex items-center gap-3 mt-1.5">
          {district.enrollment != null && (
            <span className="text-xs text-[#6E6390]">
              <span className="text-[#A69DC0]">Enroll</span>{" "}
              <span className="font-medium">{district.enrollment.toLocaleString()}</span>
            </span>
          )}
          {district.ownerUser && (
            <span className="text-xs text-[#8A80A8] truncate max-w-[100px]">
              {district.ownerUser.fullName}
            </span>
          )}
        </div>

        {/* Adaptive metrics (filter-aware) */}
        {adaptiveMetrics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {adaptiveMetrics.map((m) => (
              <span
                key={m.label}
                className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-plum/8 text-plum/80"
              >
                {m.label}: {m.value}
              </span>
            ))}
          </div>
        )}

        {/* Plan badges */}
        {district.territoryPlans?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {district.territoryPlans.map((tp) => (
              <span
                key={tp.plan.id}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F7F5FA] text-[#6E6390]"
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tp.plan.color }} />
                {tp.plan.name}
              </span>
            ))}
          </div>
        )}

        {/* Explore button */}
        <div className="mt-2">
          <button
            onClick={(e) => { e.stopPropagation(); onExplore(district.leaid); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-plum bg-plum/8 hover:bg-plum/15 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Explore
          </button>
        </div>
      </div>
    </div>
  );
}

// Determine adaptive metrics based on which filters are active
function getAdaptiveMetrics(
  district: DistrictCardData,
  activeFilters: ExploreFilter[]
): Array<{ label: string; value: string }> {
  const metrics: Array<{ label: string; value: string }> = [];
  const filterColumns = new Set(activeFilters.map((f) => f.column));

  if (filterColumns.has("ell_percent") && district.ellPct != null) {
    metrics.push({ label: "ELL", value: `${Number(district.ellPct).toFixed(1)}%` });
  }
  if (filterColumns.has("sped_percent") && district.swdPct != null) {
    metrics.push({ label: "SWD", value: `${Number(district.swdPct).toFixed(1)}%` });
  }
  if (filterColumns.has("free_lunch_percent") && district.childrenPovertyPercent != null) {
    metrics.push({ label: "Poverty", value: `${Number(district.childrenPovertyPercent).toFixed(1)}%` });
  }
  if (filterColumns.has("medianHouseholdIncome") && district.medianHouseholdIncome != null) {
    metrics.push({ label: "Income", value: `$${(Number(district.medianHouseholdIncome) / 1000).toFixed(0)}k` });
  }
  if (filterColumns.has("expenditurePerPupil") && district.expenditurePerPupil != null) {
    metrics.push({ label: "$/Pupil", value: `$${(Number(district.expenditurePerPupil) / 1000).toFixed(1)}k` });
  }

  // Fallback when no demographic filters active
  if (metrics.length === 0) {
    if (district.expenditurePerPupil != null) {
      metrics.push({ label: "$/Pupil", value: `$${(Number(district.expenditurePerPupil) / 1000).toFixed(1)}k` });
    }
    const pipeline = getFinancial(district.districtFinancials, "fullmind", "FY26", "openPipeline");
    if (pipeline != null && pipeline > 0) {
      metrics.push({ label: "Pipeline", value: `$${(pipeline / 1000).toFixed(0)}k` });
    }
  }

  return metrics.slice(0, 3); // Max 3 adaptive metrics
}
