"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlans } from "@/lib/api";

export default function PlansListPanel() {
  const viewPlan = useMapV2Store((s) => s.viewPlan);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);

  const { data: plans, isLoading } = useTerritoryPlans();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Territory Plans
        </span>
        <button
          onClick={startNewPlan}
          className="text-xs font-medium text-plum hover:text-plum/80 transition-colors"
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
                <div className="h-3.5 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : plans && plans.length > 0 ? (
          plans.map((plan) => (
            <button
              key={plan.id}
              onClick={() => viewPlan(plan.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-all text-left group"
            >
              <div
                className="w-3 h-3 rounded-md shrink-0 shadow-sm"
                style={{ backgroundColor: plan.color || "#403770" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-700 truncate group-hover:text-gray-900">
                  {plan.name}
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <span>FY {plan.fiscalYear}</span>
                  <span>·</span>
                  <span>{plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium capitalize ${
                      plan.status === "active"
                        ? "bg-green-100 text-green-700"
                        : plan.status === "archived"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300 group-hover:text-gray-400">
                <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))
        ) : (
          <div className="text-center py-8">
            <div className="text-gray-300 mb-3">
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none" className="mx-auto">
                <rect x="6" y="6" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M12 12H20M12 16H20M12 20H16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <p className="text-xs text-gray-400 mb-3">No plans yet</p>
            <button
              onClick={startNewPlan}
              className="px-4 py-2 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all"
            >
              Create First Plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
