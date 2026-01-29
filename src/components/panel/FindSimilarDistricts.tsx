"use client";

import { useState, useEffect, useRef } from "react";
import {
  useSimilarDistricts,
  useTerritoryPlans,
  useAddDistrictsToPlan,
  type SimilarMetricKey,
  type SimilarityTolerance,
  type SimilarDistrictResult,
  type District,
  type DistrictEducationData,
  type DistrictEnrollmentDemographics,
} from "@/lib/api";
import { useMapStore } from "@/lib/store";

// Available metrics for comparison
const METRICS: { key: SimilarMetricKey; label: string; shortLabel: string }[] = [
  { key: "enrollment", label: "Enrollment", shortLabel: "Enroll" },
  { key: "locale", label: "Locale", shortLabel: "Locale" },
  { key: "medianIncome", label: "Median Income", shortLabel: "Income" },
  { key: "expenditurePerPupil", label: "Expenditure/Pupil", shortLabel: "$/Pupil" },
  { key: "avgSalary", label: "Avg Salary", shortLabel: "Salary" },
  { key: "ellPercent", label: "ELL %", shortLabel: "ELL" },
  { key: "swdPercent", label: "SWD %", shortLabel: "SWD" },
  { key: "pocRate", label: "POC Rate", shortLabel: "POC" },
];

// Tolerance presets
const TOLERANCES: { value: SimilarityTolerance; label: string }[] = [
  { value: "tight", label: "Very Similar" },
  { value: "medium", label: "Somewhat Similar" },
  { value: "loose", label: "Broadly Similar" },
];

interface FindSimilarDistrictsProps {
  district: District;
  educationData: DistrictEducationData | null;
  enrollmentDemographics: DistrictEnrollmentDemographics | null;
}

// Format metric value for display
function formatMetricValue(key: SimilarMetricKey, value: number | string | null): string {
  if (value === null) return "N/A";

  switch (key) {
    case "locale":
      // Urban-centric locale codes
      const localeLabels: Record<number, string> = {
        11: "City-Large", 12: "City-Mid", 13: "City-Small",
        21: "Suburb-Large", 22: "Suburb-Mid", 23: "Suburb-Small",
        31: "Town-Fringe", 32: "Town-Distant", 33: "Town-Remote",
        41: "Rural-Fringe", 42: "Rural-Distant", 43: "Rural-Remote",
      };
      return localeLabels[value as number] || String(value);
    case "medianIncome":
    case "avgSalary":
    case "expenditurePerPupil":
      return "$" + Math.round(value as number).toLocaleString();
    case "ellPercent":
    case "swdPercent":
    case "pocRate":
      return (value as number).toFixed(1) + "%";
    case "enrollment":
      return Math.round(value as number).toLocaleString();
    default:
      return String(value);
  }
}

// Check if a metric has data for this district
function hasMetricData(
  key: SimilarMetricKey,
  district: District,
  educationData: DistrictEducationData | null,
  enrollmentDemographics: DistrictEnrollmentDemographics | null
): boolean {
  switch (key) {
    case "enrollment":
      return district.enrollment !== null;
    case "locale":
      return district.urbanCentricLocale !== null;
    case "medianIncome":
      return educationData?.medianHouseholdIncome !== null;
    case "expenditurePerPupil":
      return educationData?.expenditurePerPupil !== null;
    case "avgSalary":
      return educationData?.salariesTotal !== null && educationData?.staffTotalFte !== null;
    case "ellPercent":
      return district.ellStudents !== null && district.enrollment !== null;
    case "swdPercent":
      return district.specEdStudents !== null && district.enrollment !== null;
    case "pocRate":
      return enrollmentDemographics?.totalEnrollment !== null &&
             enrollmentDemographics?.enrollmentWhite !== null;
    default:
      return false;
  }
}

export default function FindSimilarDistricts({
  district,
  educationData,
  enrollmentDemographics,
}: FindSimilarDistrictsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState<SimilarMetricKey[]>([]);
  const [tolerance, setTolerance] = useState<SimilarityTolerance>("medium");
  const [hasSearched, setHasSearched] = useState(false);
  const [showPlanSelector, setShowPlanSelector] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { setSelectedLeaid, setSimilarDistrictLeaids, clearSimilarDistricts } = useMapStore();
  const { data: plans } = useTerritoryPlans();
  const addDistrictsToPlan = useAddDistrictsToPlan();

  // Query similar districts (only when hasSearched is true)
  const {
    data: similarData,
    isLoading,
    error,
  } = useSimilarDistricts({
    leaid: district.leaid,
    metrics: selectedMetrics,
    tolerance,
    enabled: hasSearched && selectedMetrics.length > 0,
  });

  // Calculate dropdown position when opening
  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      // Position dropdown below and to the left of button, extending outside panel
      setDropdownPosition({
        top: rect.bottom + 8,
        left: Math.max(16, rect.left - 100), // Shift left but keep on screen
      });
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        // Don't close if clicking plan selector
        if (showPlanSelector) return;
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, showPlanSelector]);

  // Update map highlighting when results change
  useEffect(() => {
    if (similarData?.results) {
      setSimilarDistrictLeaids(similarData.results.map((r) => r.leaid));
    }
  }, [similarData, setSimilarDistrictLeaids]);

  // Clear results when district changes or component unmounts
  useEffect(() => {
    return () => {
      clearSimilarDistricts();
    };
  }, [district.leaid, clearSimilarDistricts]);

  // Reset state when district changes
  useEffect(() => {
    setSelectedMetrics([]);
    setHasSearched(false);
    setShowPlanSelector(null);
    setIsOpen(false);
  }, [district.leaid]);

  const handleMetricToggle = (key: SimilarMetricKey) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(key)) {
        return prev.filter((m) => m !== key);
      }
      if (prev.length >= 3) {
        return prev;
      }
      return [...prev, key];
    });
    setHasSearched(false);
  };

  const handleSearch = () => {
    if (selectedMetrics.length > 0) {
      setHasSearched(true);
    }
  };

  const handleClearResults = () => {
    setHasSearched(false);
    clearSimilarDistricts();
  };

  const handleSelectDistrict = (leaid: string) => {
    setIsOpen(false);
    setSelectedLeaid(leaid);
    clearSimilarDistricts();
    setHasSearched(false);
  };

  const handleAddToPlan = async (planId: string, leaids: string[]) => {
    try {
      await addDistrictsToPlan.mutateAsync({ planId, leaids });
      setShowPlanSelector(null);
    } catch (error) {
      console.error("Failed to add districts to plan:", error);
    }
  };

  const results = similarData?.results || [];

  return (
    <div className="relative">
      {/* Button */}
      <button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#403770] bg-white border border-[#403770] rounded-lg hover:bg-gray-50 transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        Find Similar
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown - Fixed position to extend outside panel */}
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-[100] overflow-hidden"
          style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
        >
          <div className="p-4 space-y-4">
            {/* Metric Chips */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Select up to 3 metrics:</p>
              <div className="flex flex-wrap gap-1.5">
                {METRICS.map((metric) => {
                  const isSelected = selectedMetrics.includes(metric.key);
                  const isDisabled =
                    !hasMetricData(metric.key, district, educationData, enrollmentDemographics) ||
                    (!isSelected && selectedMetrics.length >= 3);

                  return (
                    <button
                      key={metric.key}
                      onClick={() => !isDisabled && handleMetricToggle(metric.key)}
                      disabled={isDisabled}
                      className={`px-2.5 py-1 text-xs font-medium rounded-full transition-colors ${
                        isSelected
                          ? "bg-[#403770] text-white"
                          : isDisabled
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      title={isDisabled && !isSelected ? "No data available" : metric.label}
                    >
                      {metric.shortLabel}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tolerance Selection */}
            <div>
              <p className="text-xs text-gray-500 mb-2">Similarity:</p>
              <div className="flex gap-1.5">
                {TOLERANCES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => {
                      setTolerance(t.value);
                      setHasSearched(false);
                    }}
                    className={`flex-1 px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                      tolerance === t.value
                        ? "bg-[#6EA3BE] text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={selectedMetrics.length === 0 || isLoading}
              className="w-full px-3 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "Searching..." : "Search"}
            </button>

            {/* Error State */}
            {error && (
              <div className="p-2 bg-red-50 text-red-700 text-xs rounded-lg">
                {error.message || "Failed to find similar districts"}
              </div>
            )}

            {/* Results */}
            {hasSearched && !isLoading && !error && (
              <div className="space-y-2 border-t border-gray-100 pt-3">
                {/* Results Header */}
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-600">
                    {results.length} similar district{results.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex gap-2">
                    {results.length > 0 && (
                      <div className="relative">
                        <button
                          onClick={() => setShowPlanSelector(showPlanSelector === "all" ? null : "all")}
                          className="text-xs text-[#403770] hover:underline"
                        >
                          Add All
                        </button>
                        {showPlanSelector === "all" && (
                          <PlanSelectorDropdown
                            plans={plans || []}
                            onSelect={(planId) => handleAddToPlan(planId, results.map((r) => r.leaid))}
                            onClose={() => setShowPlanSelector(null)}
                            isPending={addDistrictsToPlan.isPending}
                          />
                        )}
                      </div>
                    )}
                    <button
                      onClick={handleClearResults}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                {/* Result Cards */}
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {results.map((result) => (
                    <ResultCard
                      key={result.leaid}
                      result={result}
                      selectedMetrics={selectedMetrics}
                      onSelect={() => handleSelectDistrict(result.leaid)}
                      onAddToPlan={() => setShowPlanSelector(result.leaid)}
                      showPlanSelector={showPlanSelector === result.leaid}
                      plans={plans || []}
                      onPlanSelect={(planId) => handleAddToPlan(planId, [result.leaid])}
                      onClosePlanSelector={() => setShowPlanSelector(null)}
                      isPending={addDistrictsToPlan.isPending}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Result Card Component
function ResultCard({
  result,
  selectedMetrics,
  onSelect,
  onAddToPlan,
  showPlanSelector,
  plans,
  onPlanSelect,
  onClosePlanSelector,
  isPending,
}: {
  result: SimilarDistrictResult;
  selectedMetrics: SimilarMetricKey[];
  onSelect: () => void;
  onAddToPlan: () => void;
  showPlanSelector: boolean;
  plans: { id: string; name: string; color: string }[];
  onPlanSelect: (planId: string) => void;
  onClosePlanSelector: () => void;
  isPending: boolean;
}) {
  const isInPlan = result.territoryPlanIds.length > 0;

  return (
    <div className="p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={onSelect}
          className="flex-1 text-left"
        >
          <p className="text-xs font-medium text-[#403770]">{result.name}</p>
        </button>

        <div className="flex items-center gap-1">
          {isInPlan && (
            <span className="w-1.5 h-1.5 rounded-full bg-[#8AA891]" title="In a plan" />
          )}
          <div className="relative">
            <button
              onClick={onAddToPlan}
              className="p-0.5 text-gray-400 hover:text-[#403770] transition-colors"
              title="Add to plan"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {showPlanSelector && (
              <PlanSelectorDropdown
                plans={plans}
                onSelect={onPlanSelect}
                onClose={onClosePlanSelector}
                isPending={isPending}
              />
            )}
          </div>
        </div>
      </div>

      {/* Metric Values */}
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
        {selectedMetrics.map((key) => {
          const metricData = result.metrics[key];
          if (!metricData) return null;

          const label = METRICS.find((m) => m.key === key)?.shortLabel || key;

          return (
            <span key={key} className="text-[10px] text-gray-500">
              {label}: {formatMetricValue(key, metricData.value)}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// Plan Selector Dropdown
function PlanSelectorDropdown({
  plans,
  onSelect,
  onClose,
  isPending,
}: {
  plans: { id: string; name: string; color: string }[];
  onSelect: (planId: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />

      <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden">
        {plans.length === 0 ? (
          <p className="p-2 text-xs text-gray-500">No plans yet</p>
        ) : (
          <div className="max-h-40 overflow-y-auto">
            {plans.map((plan) => (
              <button
                key={plan.id}
                onClick={() => onSelect(plan.id)}
                disabled={isPending}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs hover:bg-gray-50 disabled:opacity-50"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: plan.color }}
                />
                <span className="truncate">{plan.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
