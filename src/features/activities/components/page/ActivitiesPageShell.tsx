"use client";

import { useEffect, useMemo, useState } from "react";
import { useActivities, useProfile } from "@/lib/api";
import { usePrefetchActivity } from "@/features/activities/lib/queries";
import { getCategoryForType } from "@/features/activities/types";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import {
  useActivitiesChrome,
  deriveActivitiesParams,
  applyClientFilters,
  useDefaultOwnerHydration,
} from "@/features/activities/lib/filters-store";
import ActivitiesPageHeader from "./ActivitiesPageHeader";
import ActivitiesFilterChips from "./ActivitiesFilterChips";
import CommandBar, { useCommandBarHotkey } from "./CommandBar";
import SavedViewTabs from "./SavedViewTabs";
import ScheduleView from "./ScheduleView";
import MonthView from "./MonthView";
import WeekGridView from "./WeekGridView";
import MapTimeView from "./MapTimeView";
import UpcomingRail from "./UpcomingRail";
import ActivityDetailDrawer from "./ActivityDetailDrawer";
import BackfillSetupModal from "@/features/calendar/components/backfill/BackfillSetupModal";
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

  // Seed default owner from current profile on mount; ref-guarded so a manual
  // selection survives subsequent renders.
  useDefaultOwnerHydration();

  const [openActivityId, setOpenActivityId] = useState<string | null>(null);
  const [creatingActivity, setCreatingActivity] = useState(false);
  const [commandBarOpen, setCommandBarOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  useCommandBarHotkey(setCommandBarOpen);

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

  // Drawer prev/next: walk the filtered list in chronological order so navigation
  // matches the user's mental model of "next thing on the calendar."
  const drawerNeighbors = useMemo(() => {
    if (!openActivityId) return { prevId: null, nextId: null };
    const ordered = [...filtered].sort((a, b) => {
      const ta = a.startDate ? new Date(a.startDate).getTime() : 0;
      const tb = b.startDate ? new Date(b.startDate).getTime() : 0;
      return ta - tb;
    });
    const idx = ordered.findIndex((a) => a.id === openActivityId);
    if (idx === -1) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? ordered[idx - 1].id : null,
      nextId: idx < ordered.length - 1 ? ordered[idx + 1].id : null,
    };
  }, [filtered, openActivityId]);

  // Warm the cache for the drawer's prev/next neighbors so chevron nav lands
  // instantly. The prefetch is a no-op when the entry is already fresh.
  const prefetchActivity = usePrefetchActivity();
  useEffect(() => {
    if (!openActivityId) return;
    if (drawerNeighbors.prevId) prefetchActivity(drawerNeighbors.prevId);
    if (drawerNeighbors.nextId) prefetchActivity(drawerNeighbors.nextId);
  }, [openActivityId, drawerNeighbors.prevId, drawerNeighbors.nextId, prefetchActivity]);

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
        onReviewPending={() => setPendingModalOpen(true)}
      />
      <SavedViewTabs currentUserId={profile?.id ?? null} />
      <ActivitiesFilterChips onOpenCommandBar={() => setCommandBarOpen(true)} />

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

        <div className="hidden md:flex">
          <UpcomingRail
            activities={upcomingFiltered}
            onActivityClick={setOpenActivityId}
            scope={railScope}
            onNewActivity={() => setCreatingActivity(true)}
          />
        </div>
      </div>

      <ActivityDetailDrawer
        activityId={openActivityId}
        onClose={() => setOpenActivityId(null)}
        canPrev={drawerNeighbors.prevId !== null}
        canNext={drawerNeighbors.nextId !== null}
        onNavigate={(dir) => {
          const target =
            dir === "next" ? drawerNeighbors.nextId : drawerNeighbors.prevId;
          if (target) setOpenActivityId(target);
        }}
      />

      {creatingActivity && (
        <ActivityFormModal isOpen onClose={() => setCreatingActivity(false)} />
      )}

      <CommandBar open={commandBarOpen} onClose={() => setCommandBarOpen(false)} />
      <BackfillSetupModal
        isOpen={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        initialStep="wizard"
      />
    </div>
  );
}
