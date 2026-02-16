"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useActivities } from "@/lib/api";
import type { ActivityListItem } from "@/lib/api";
import type { ActivityStatus } from "@/lib/activityTypes";
import {
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
} from "@/lib/activityTypes";

// Filter chip options
const FILTER_OPTIONS: { label: string; value: ActivityStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Planned", value: "planned" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function formatActivityDate(
  startDate: string | null,
  endDate: string | null
): string | null {
  if (!startDate) return null;

  const fmt = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const startFormatted = fmt(startDate);

  if (!endDate || endDate === startDate) return startFormatted;

  return `${startFormatted} \u2013 ${fmt(endDate)}`;
}

export default function PlanActivitiesSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);

  const [statusFilter, setStatusFilter] = useState<
    ActivityStatus | undefined
  >(undefined);

  const { data, isLoading } = useActivities({
    planId: activePlanId || undefined,
    status: statusFilter,
  });

  const activities = data?.activities ?? [];

  return (
    <div className="p-3 space-y-3">
      {/* Filter chips */}
      <div className="flex gap-1.5">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = statusFilter === opt.value;
          return (
            <button
              key={opt.label}
              onClick={() => setStatusFilter(opt.value)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-gray-800 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {isLoading && <LoadingSkeleton />}

      {/* Activity list */}
      {!isLoading && activities.length > 0 && (
        <div className="space-y-1">
          {activities.map((activity) => (
            <ActivityRow
              key={activity.id}
              activity={activity}
              onClick={(id) =>
                openRightPanel({ type: "activity_edit", id })
              }
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && activities.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-300 mb-2">
            <svg
              width="32"
              height="32"
              viewBox="0 0 32 32"
              fill="none"
              className="mx-auto"
            >
              <rect
                x="5"
                y="6"
                width="22"
                height="20"
                rx="3"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <path
                d="M5 12H27"
                stroke="currentColor"
                strokeWidth="1.5"
              />
              <circle cx="11" cy="18" r="1.5" fill="currentColor" />
              <circle cx="16" cy="18" r="1.5" fill="currentColor" />
              <circle cx="21" cy="18" r="1.5" fill="currentColor" />
              <circle cx="11" cy="22" r="1.5" fill="currentColor" />
            </svg>
          </div>
          <p className="text-xs text-gray-400 font-medium">
            No activities yet
          </p>
          <p className="text-[10px] text-gray-300 mt-0.5">
            Create an activity to start tracking outreach
          </p>
        </div>
      )}

      {/* New Activity button */}
      <button
        onClick={() => openRightPanel({ type: "activity_form" })}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-gray-200 text-xs font-medium text-gray-400 hover:border-gray-300 hover:text-gray-500 hover:bg-gray-50/50 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M6 2V10M2 6H10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        New Activity
      </button>
    </div>
  );
}

function ActivityRow({
  activity,
  onClick,
}: {
  activity: ActivityListItem;
  onClick: (id: string) => void;
}) {
  const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status];
  const typeIcon = ACTIVITY_TYPE_ICONS[activity.type] ?? "📌";
  const dateStr = formatActivityDate(activity.startDate, activity.endDate);
  const districtCount = activity.districtCount ?? 0;

  return (
    <div
      onClick={() => onClick(activity.id)}
      className="flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group"
    >
      {/* Type emoji */}
      <span className="text-sm shrink-0 w-5 text-center">{typeIcon}</span>

      {/* Title */}
      <span
        className="flex-1 text-xs text-gray-700 font-medium truncate"
        title={activity.title}
      >
        {activity.title}
      </span>

      {/* Status badge */}
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium shrink-0"
        style={{
          backgroundColor: statusConfig.bgColor,
          color: statusConfig.color,
        }}
      >
        {statusConfig.label}
      </span>

      {/* Date */}
      {dateStr && (
        <span className="text-[9px] font-medium text-gray-400 shrink-0">
          {dateStr}
        </span>
      )}

      {/* District count */}
      {districtCount > 0 && (
        <span className="text-[9px] font-medium text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5 shrink-0">
          {districtCount}d
        </span>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-2.5 py-2 rounded-xl"
        >
          <div className="w-5 h-5 rounded bg-gray-100 animate-pulse" />
          <div className="flex-1 h-3 bg-gray-100 rounded animate-pulse" />
          <div className="w-14 h-4 bg-gray-100 rounded-full animate-pulse" />
          <div className="w-10 h-3 bg-gray-100 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
