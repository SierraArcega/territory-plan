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
}

export default function ActivitiesPageHeader({
  count,
  onNewActivity,
  scope,
  onScopeChange,
}: ActivitiesPageHeaderProps) {
  const view = useActivitiesChrome((s) => s.view);
  const setView = useActivitiesChrome((s) => s.setView);

  return (
    <header className="bg-white border-b border-[#E2DEEC] px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-[#403770] tracking-[-0.01em]">Activities</h1>
          <p className="text-xs text-[#8A80A8]">
            Showing{" "}
            <span className="font-medium text-[#6E6390]">{count.toLocaleString()}</span>{" "}
            in this range
          </p>
        </div>

        <div className="flex items-center gap-2">
          <ScopeToggle scope={scope} onChange={onScopeChange} />
          <CalendarSyncBadge />
          <ViewToggle value={view} onChange={setView} />
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
