"use client";

import { useState, useMemo } from "react";
import { useActivities } from "@/features/activities/lib/queries";
import ActivityFilterChips from "./ActivityFilterChips";
import ActivityTimelineItem from "./ActivityTimelineItem";
import type { ActivityListItem } from "@/features/shared/types/api-types";

interface ActivityTimelineProps {
  districtLeaid: string;
}

function groupByDate(
  activities: ActivityListItem[]
): { label: string; activities: ActivityListItem[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups = new Map<string, ActivityListItem[]>();
  const labelMap = new Map<string, string>();

  for (const activity of activities) {
    const dateStr = activity.startDate || activity.endDate;
    let key: string;
    let label: string;

    if (!dateStr) {
      key = "unscheduled";
      label = "Unscheduled";
    } else {
      const d = new Date(dateStr);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());

      if (dayStart.getTime() === today.getTime()) {
        key = "today";
        label = "Today";
      } else if (dayStart.getTime() === yesterday.getTime()) {
        key = "yesterday";
        label = "Yesterday";
      } else {
        key = dayStart.toISOString();
        label = d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
      }
    }

    if (!groups.has(key)) {
      groups.set(key, []);
      labelMap.set(key, label);
    }
    groups.get(key)!.push(activity);
  }

  // Convert to array, ordered by the first activity's date in each group
  return Array.from(groups.entries()).map(([key, acts]) => ({
    label: labelMap.get(key) || key,
    activities: acts,
  }));
}

export default function ActivityTimeline({
  districtLeaid,
}: ActivityTimelineProps) {
  const [sourceFilter, setSourceFilter] = useState<string | null>(null);

  const { data, isLoading } = useActivities({
    districtLeaid,
    source: sourceFilter || undefined,
    limit: 50,
  });

  const groups = useMemo(() => {
    if (!data?.activities) return [];
    return groupByDate(data.activities);
  }, [data?.activities]);

  return (
    <div className="space-y-3">
      {/* Filter chips */}
      <ActivityFilterChips
        activeFilter={sourceFilter}
        onFilterChange={setSourceFilter}
      />

      {/* Timeline content */}
      {isLoading ? (
        <TimelineSkeleton />
      ) : groups.length === 0 ? (
        <div className="text-center py-6 px-4">
          <p className="text-sm text-gray-400">
            No activity yet. Connect your accounts in Profile to start syncing,
            or log an activity manually.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[10px] top-4 bottom-0 w-px bg-gray-200" />

          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.label}>
                {/* Date header */}
                <div className="relative z-10 mb-2">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-white pr-2">
                    {group.label}
                  </span>
                </div>

                {/* Activity items */}
                <div className="space-y-2">
                  {group.activities.map((activity) => (
                    <ActivityTimelineItem
                      key={activity.id}
                      activity={activity}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TimelineSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-3">
          <div className="w-[22px] h-[22px] rounded-full bg-gray-200 animate-pulse shrink-0" />
          <div className="flex-1 border border-gray-100 rounded-lg p-3 space-y-2 animate-pulse">
            <div className="h-3 bg-gray-200 rounded w-2/3" />
            <div className="h-2.5 bg-gray-100 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
