"use client";

import { useState, useMemo } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlan } from "@/lib/api";
import type { TerritoryPlanDistrict } from "@/lib/api";

type SortBy = "alpha" | "enrollment" | "state";

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString();
}

export default function PlanOverviewSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const setPanelState = useMapV2Store((s) => s.setPanelState);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const [sortBy, setSortBy] = useState<SortBy>("alpha");

  const totalEnrollment = useMemo(() => {
    if (!plan) return 0;
    return plan.districts.reduce((sum, d) => sum + (d.enrollment || 0), 0);
  }, [plan]);

  const sortedDistricts = useMemo(() => {
    if (!plan) return [];
    const districts = [...plan.districts];
    switch (sortBy) {
      case "alpha":
        return districts.sort((a, b) => a.name.localeCompare(b.name));
      case "enrollment":
        return districts.sort(
          (a, b) => (b.enrollment || 0) - (a.enrollment || 0)
        );
      case "state":
        return districts.sort((a, b) => {
          const stateCompare = (a.stateAbbrev || "").localeCompare(
            b.stateAbbrev || ""
          );
          if (stateCompare !== 0) return stateCompare;
          return a.name.localeCompare(b.name);
        });
      default:
        return districts;
    }
  }, [plan, sortBy]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!plan) {
    return (
      <div className="p-3 text-center py-8 text-xs text-gray-400">
        Plan not found
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            Districts
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {plan.districts.length}
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            Total Enrollment
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {formatNumber(totalEnrollment)}
          </div>
        </div>
      </div>

      {/* Sort + Add row */}
      <div className="flex items-center gap-1.5">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <SortButton
            label="A-Z"
            active={sortBy === "alpha"}
            onClick={() => setSortBy("alpha")}
          />
          <SortButton
            label="Size"
            active={sortBy === "enrollment"}
            onClick={() => setSortBy("enrollment")}
          />
          <SortButton
            label="State"
            active={sortBy === "state"}
            onClick={() => setSortBy("state")}
          />
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setPanelState("PLAN_ADD")}
          className="px-2.5 py-1 text-xs font-medium text-plum bg-plum/10 rounded-lg hover:bg-plum/15 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* District list */}
      {sortedDistricts.length > 0 ? (
        <div className="space-y-0.5">
          {sortedDistricts.map((d) => (
            <DistrictRow
              key={d.leaid}
              district={d}
              planColor={plan.color}
              onClick={() => selectDistrict(d.leaid)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setPanelState("PLAN_ADD")} />
      )}
    </div>
  );
}

function SortButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
        active
          ? "bg-white text-gray-700 shadow-sm"
          : "text-gray-400 hover:text-gray-600"
      }`}
    >
      {label}
    </button>
  );
}

function DistrictRow({
  district,
  planColor,
  onClick,
}: {
  district: TerritoryPlanDistrict;
  planColor: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
    >
      <div
        className="w-2.5 h-2.5 rounded-md shrink-0"
        style={{ backgroundColor: planColor || "#403770" }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-700 truncate">{district.name}</div>
        <div className="text-xs text-gray-400">
          {district.stateAbbrev}
          {district.enrollment
            ? ` \u00b7 ${district.enrollment.toLocaleString()}`
            : ""}
        </div>
      </div>
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        className="text-gray-300 group-hover:text-gray-400 shrink-0"
      >
        <path
          d="M4.5 3L7.5 6L4.5 9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-xs text-gray-400 mb-3">
        No districts in this plan yet
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-plum/10 text-plum text-xs font-medium rounded-xl hover:bg-plum/15 transition-all"
      >
        Add Districts
      </button>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-2.5 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Sort bar skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-7 bg-gray-100 rounded-lg w-36 animate-pulse" />
        <div className="flex-1" />
        <div className="h-7 bg-plum/10 rounded-lg w-14 animate-pulse" />
      </div>
      {/* District list skeleton */}
      <div className="space-y-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 animate-pulse"
          >
            <div className="w-2.5 h-2.5 rounded-md bg-gray-200 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="h-3.5 bg-gray-200 rounded w-3/4" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
