"use client";

import { useMemo, useState } from "react";
import { useActivities, useProfile } from "@/lib/api";
import { getCategoryForType } from "@/features/activities/types";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import {
  useActivitiesChrome,
  deriveActivitiesParams,
  applyClientFilters,
} from "@/features/activities/lib/filters-store";
import ActivitiesPageHeader from "./ActivitiesPageHeader";
import ActivitiesFilterRail from "./ActivitiesFilterRail";
import SavedViewTabs from "./SavedViewTabs";
import ScheduleView from "./ScheduleView";
import MonthView from "./MonthView";
import WeekGridView from "./WeekGridView";
import MapTimeView from "./MapTimeView";
import UpcomingRail from "./UpcomingRail";
import ActivityDetailDrawer from "./ActivityDetailDrawer";
import type { ActivityScope } from "./ScopeToggle";

/**
 * Top-level Activities page shell. Composes header (with embedded date range +
 * scope toggle), saved view tabs, filter shell, view body, upcoming rail, and
 * the activity detail drawer.
 *
 * App is SPA via `?tab=activities` — there is intentionally no
 * `src/app/activities/page.tsx`; ActivitiesView mounts this shell.
 */
export default function ActivitiesPageShell() {
  const { data: profile } = useProfile();
  const view = useActivitiesChrome((s) => s.view);
  const grain = useActivitiesChrome((s) => s.grain);
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  const [openActivityId, setOpenActivityId] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);

  const params = useMemo(
    () => deriveActivitiesParams({ filters, anchorIso, grain }),
    [filters, anchorIso, grain]
  );

  const { data, isLoading } = useActivities(params);
  const filtered = useMemo(
    () => applyClientFilters(data?.activities ?? [], filters, getCategoryForType),
    [data, filters]
  );

  // Upcoming-rail rolls 14 days forward from today regardless of the visible window.
  const upcomingParams = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getTime() + 14 * 86400000);
    return {
      startDateFrom: now.toISOString().slice(0, 10),
      startDateTo: end.toISOString().slice(0, 10),
      ownerId: filters.owners.length === 1 ? filters.owners[0] : "all",
      limit: 200,
    };
  }, [filters.owners]);
  const { data: upcomingData } = useActivities(upcomingParams);
  const upcomingFiltered = useMemo(
    () => applyClientFilters(upcomingData?.activities ?? [], filters, getCategoryForType),
    [upcomingData, filters]
  );

  // Scope is derived from filters.owners: solo-current-user → "mine", empty → "all".
  // Any other owner selection ("custom") still reads as "all" for header copy.
  const scope: ActivityScope =
    profile?.id && filters.owners.length === 1 && filters.owners[0] === profile.id
      ? "mine"
      : "all";

  const railScope = scope === "mine" ? "mine" : "team";

  const onScopeChange = (next: ActivityScope) => {
    if (!profile?.id) return;
    patchFilters({ owners: next === "mine" ? [profile.id] : [] });
  };

  return (
    <div className="flex flex-col h-full bg-[#FFFCFA] overflow-hidden">
      <ActivitiesPageHeader
        count={filtered.length}
        onNewActivity={() => setCreatingActivity(true)}
        scope={scope}
        onScopeChange={onScopeChange}
      />
      <SavedViewTabs currentUserId={profile?.id ?? null} />
      <ActivitiesFilterRail />

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {view === "schedule" && (
            <ScheduleView
              activities={filtered}
              isLoading={isLoading}
              onActivityClick={setOpenActivityId}
            />
          )}
          {view === "month" && (
            <MonthView activities={filtered} onActivityClick={setOpenActivityId} />
          )}
          {view === "week" && (
            <WeekGridView activities={filtered} onActivityClick={setOpenActivityId} />
          )}
          {view === "map" && (
            <MapTimeView activities={filtered} onActivityClick={setOpenActivityId} />
          )}
        </div>

        <UpcomingRail
          activities={upcomingFiltered}
          onActivityClick={setOpenActivityId}
          scope={railScope}
        />
      </div>

      <ActivityDetailDrawer
        activityId={openActivityId}
        onClose={() => setOpenActivityId(null)}
      />

      {creatingActivity && (
        <ActivityFormModal isOpen onClose={() => setCreatingActivity(false)} />
      )}
    </div>
  );
}
