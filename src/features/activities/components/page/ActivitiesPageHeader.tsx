"use client";

import { Plus } from "lucide-react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import ViewToggle from "./ViewToggle";
import CalendarSyncBadge from "./CalendarSyncBadge";

export default function ActivitiesPageHeader({
  count,
  onNewActivity,
}: {
  count: number;
  onNewActivity: () => void;
}) {
  const view = useActivitiesChrome((s) => s.view);
  const setView = useActivitiesChrome((s) => s.setView);

  return (
    <header className="bg-white border-b border-[#E2DEEC] px-6 py-3">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#403770]">Activities</h1>
          <p className="text-xs text-[#8A80A8]">
            Showing <span className="font-medium text-[#6E6390]">{count.toLocaleString()}</span> in this range
          </p>
        </div>

        <div className="flex items-center gap-2">
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
    </header>
  );
}
