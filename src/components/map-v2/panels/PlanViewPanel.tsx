"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlan } from "@/lib/api";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  active: { bg: "bg-green-100", text: "text-green-700" },
  archived: { bg: "bg-amber-100", text: "text-amber-700" },
};

export default function PlanViewPanel() {
  const goBack = useMapV2Store((s) => s.goBack);
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const setPanelState = useMapV2Store((s) => s.setPanelState);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);

  const badge = plan ? STATUS_BADGE[plan.status] || STATUS_BADGE.draft : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Plan
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : plan ? (
          <>
            {/* Plan name */}
            <h2 className="text-base font-bold text-gray-800 leading-tight">
              {plan.name}
            </h2>

            {/* Badges */}
            <div className="flex gap-2 flex-wrap">
              {badge && (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text} capitalize`}>
                  {plan.status}
                </span>
              )}
              <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-plum/10 text-plum">
                FY {plan.fiscalYear}
              </span>
            </div>

            {plan.description && (
              <p className="text-xs text-gray-500 leading-relaxed">{plan.description}</p>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-gray-50 p-2.5">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Districts</div>
                <div className="text-sm font-semibold text-gray-700">{plan.districts.length}</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-2.5">
                <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Total Enrollment</div>
                <div className="text-sm font-semibold text-gray-700">
                  {plan.districts.reduce((sum, d) => sum + (d.enrollment || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>

            {/* Add more districts button */}
            <button
              onClick={() => setPanelState("PLAN_ADD")}
              className="w-full py-2 bg-plum/10 text-plum text-sm font-medium rounded-xl hover:bg-plum/15 transition-all"
            >
              + Add Districts
            </button>

            {/* Districts list */}
            <div className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Plan Districts
            </div>
            <div className="space-y-1">
              {plan.districts.map((d) => (
                <button
                  key={d.leaid}
                  onClick={() => selectDistrict(d.leaid)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-md shrink-0"
                    style={{ backgroundColor: plan.color || "#403770" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">{d.name}</div>
                    <div className="text-xs text-gray-400">
                      {d.stateAbbrev}
                      {d.enrollment ? ` · ${d.enrollment.toLocaleString()}` : ""}
                    </div>
                  </div>
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-gray-300 group-hover:text-gray-400">
                    <path d="M4.5 3L7.5 6L4.5 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
              {plan.districts.length === 0 && (
                <div className="text-center py-6 text-xs text-gray-400">
                  No districts in this plan yet
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">Plan not found</div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
      <div className="flex gap-2">
        <div className="h-5 bg-plum/10 rounded-full w-16 animate-pulse" />
        <div className="h-5 bg-gray-100 rounded-full w-20 animate-pulse" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
