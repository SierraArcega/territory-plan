"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store, type ExploreFilter } from "@/features/map/lib/store";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";
import { mapV2Ref } from "@/features/map/lib/ref";

interface DistrictCardData {
  leaid: string;
  name: string;
  stateAbbrev: string;
  countyName: string | null;
  enrollment: number | null;
  isCustomer: boolean | null;
  accountType: string | null;
  owner: string | null;
  ellPct: number | null;
  swdPct: number | null;
  childrenPovertyPercent: number | null;
  medianHouseholdIncome: number | null;
  expenditurePerPupil: number | null;
  urbanCentricLocale: number | null;
  fy26OpenPipeline: number | null;
  fy26ClosedWonNetBooking: number | null;
  territoryPlans: Array<{ plan: { id: string; name: string; color: string } }>;
}

interface DistrictSearchCardProps {
  district: DistrictCardData;
  isSelected: boolean;
  onToggleSelect: () => void;
  activeFilters: ExploreFilter[];
}

export default function DistrictSearchCard({
  district,
  isSelected,
  onToggleSelect,
  activeFilters,
}: DistrictSearchCardProps) {
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const setHoveredLeaid = useMapV2Store((s) => s.setHoveredLeaid);
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: plans } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();

  const existingPlanIds = new Set(district.territoryPlans?.map((tp) => tp.plan.id) || []);

  // Close plan dropdown on outside click
  useEffect(() => {
    if (!showPlanDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlanDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlanDropdown]);

  const handleClick = () => {
    selectDistrict(district.leaid);
    // Fly to district on map
    const map = mapV2Ref.current;
    if (map) {
      // We don't have centroid here, but the map will highlight it
    }
  };

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: district.leaid });
      setShowPlanDropdown(false);
    } catch (error) {
      console.error("Failed to add district to plan:", error);
    }
  };

  // Determine which adaptive metrics to show based on active filters
  const adaptiveMetrics = getAdaptiveMetrics(district, activeFilters);

  return (
    <div
      className={`group relative px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
        isSelected ? "bg-coral/5 border-coral/40 ring-1 ring-coral/20" : "border-[#E2DEEC] hover:bg-[#EFEDF5] hover:border-[#D4CFE2]"
      }`}
      onClick={handleClick}
      onMouseEnter={() => setHoveredLeaid(district.leaid)}
      onMouseLeave={() => setHoveredLeaid(null)}
    >
      {/* Checkbox */}
      <div className="absolute left-1 top-3">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          className={`w-3.5 h-3.5 rounded border-[#C2BBD4] text-coral focus:ring-coral/30 cursor-pointer transition-opacity ${
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        />
      </div>

      <div className="ml-4">
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
          {district.owner && (
            <span className="text-xs text-[#8A80A8] truncate max-w-[100px]">
              {district.owner}
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

        {/* Add to Plan button */}
        <div className="relative mt-2" ref={dropdownRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPlanDropdown(!showPlanDropdown); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-plum bg-plum/8 hover:bg-plum/15 transition-colors"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add to Plan
          </button>

          {showPlanDropdown && plans && (
            <div className="absolute left-0 bottom-full mb-1 w-56 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden z-50">
              <div className="max-h-48 overflow-y-auto">
                {plans.map((plan) => {
                  const alreadyIn = existingPlanIds.has(plan.id);
                  return (
                    <button
                      key={plan.id}
                      onClick={(e) => { e.stopPropagation(); !alreadyIn && handleAddToPlan(plan.id); }}
                      disabled={alreadyIn}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                        alreadyIn ? "bg-[#EFEDF5] text-[#A69DC0]" : "hover:bg-[#EFEDF5] text-[#544A78]"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                      <span className="truncate">{plan.name}</span>
                      {alreadyIn && (
                        <svg className="w-4 h-4 text-[#8AA891] ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
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
    if (district.fy26OpenPipeline != null && Number(district.fy26OpenPipeline) > 0) {
      metrics.push({ label: "Pipeline", value: `$${(Number(district.fy26OpenPipeline) / 1000).toFixed(0)}k` });
    }
  }

  return metrics.slice(0, 3); // Max 3 adaptive metrics
}
