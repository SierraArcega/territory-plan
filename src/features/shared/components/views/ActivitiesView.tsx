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
import ActivitiesPageHeader from "@/features/activities/components/page/ActivitiesPageHeader";
import ActivitiesDateRange from "@/features/activities/components/page/ActivitiesDateRange";
import ActivitiesFilterRail from "@/features/activities/components/page/ActivitiesFilterRail";
import SavedViewTabs from "@/features/activities/components/page/SavedViewTabs";
import ScheduleView from "@/features/activities/components/page/ScheduleView";
import MonthView from "@/features/activities/components/page/MonthView";
import WeekGridView from "@/features/activities/components/page/WeekGridView";
import MapTimeView from "@/features/activities/components/page/MapTimeView";
import UpcomingRail from "@/features/activities/components/page/UpcomingRail";
import ActivityDetailDrawer from "@/features/activities/components/page/ActivityDetailDrawer";

export default function ActivitiesView() {
  const { data: profile } = useProfile();
  const view = useActivitiesChrome((s) => s.view);
  const grain = useActivitiesChrome((s) => s.grain);
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const filters = useActivitiesChrome((s) => s.filters);

  const [openActivityId, setOpenActivityId] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);

  // Derive list params from chrome + filters; multi-value filters are applied client-side.
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

  const scope: "mine" | "team" =
    filters.owners.length === 1 && filters.owners[0] === profile?.id ? "mine" : "team";

  return (
    <div className="flex flex-col h-full bg-[#FFFCFA] overflow-hidden">
      <ActivitiesPageHeader
        count={filtered.length}
        onNewActivity={() => setCreatingActivity(true)}
      />
      <div className="px-6 py-2 bg-white border-b border-[#E2DEEC]">
        <ActivitiesDateRange />
      </div>
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
          scope={scope}
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
