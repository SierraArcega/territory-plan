"use client";

import { Plus } from "lucide-react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import ViewToggle from "./ViewToggle";
import CalendarSyncBadge from "./CalendarSyncBadge";
import ActivitiesDateRange from "./ActivitiesDateRange";
import ScopeToggle, { type ActivityScope } from "./ScopeToggle";

interface ActivitiesPageHeaderProps {
  count: number;
  onNewActivity: () => void;
  scope: ActivityScope;
  onScopeChange: (scope: ActivityScope) => void;
  onReviewPending?: () => void;
}

export default function ActivitiesPageHeader({
  count,
  onNewActivity,
  scope,
  onScopeChange,
  onReviewPending,
}: ActivitiesPageHeaderProps) {
  const view = useActivitiesChrome((s) => s.view);
  const grain = useActivitiesChrome((s) => s.grain);
  const setView = useActivitiesChrome((s) => s.setView);
  const setGrain = useActivitiesChrome((s) => s.setGrain);

  return (
    <header className="bg-white border-b border-[#E2DEEC] px-6 py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#403770] tracking-[-0.01em]">Activities</h1>
          <p className="text-xs text-[#8A80A8] whitespace-nowrap">
            Showing{" "}
            <span className="font-medium text-[#6E6390]">{count.toLocaleString()}</span>{" "}
            in this range
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ScopeToggle scope={scope} onChange={onScopeChange} />
          <CalendarSyncBadge onReviewPending={onReviewPending} />
          <ViewToggle
            view={view}
            grain={grain}
            onChange={({ view: v, grain: g }) => {
              setView(v);
              setGrain(g);
            }}
          />
          <button
            type="button"
            onClick={onNewActivity}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center">
        <ActivitiesDateRange />
      </div>
    </header>
  );
}
