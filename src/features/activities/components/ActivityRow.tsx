"use client";

// ActivityRow - A single activity rendered as a clickable row.
// Used in HomeView's calendar day list and The Lineup's timeline.
// Clicking calls onOpen, which typically opens ActivityFormModal.

import { type ActivityListItem } from "@/lib/api";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  type ActivityType,
} from "@/features/activities/types";
import { formatTimeShort } from "@/features/shared/lib/date-utils";

interface ActivityRowProps {
  activity: ActivityListItem;
  onOpen: (activity: ActivityListItem) => void;
}

export default function ActivityRow({ activity, onOpen }: ActivityRowProps) {
  const statusCfg = ACTIVITY_STATUS_CONFIG[activity.status] || ACTIVITY_STATUS_CONFIG.planned;
  const typeLabel = ACTIVITY_TYPE_LABELS[activity.type as ActivityType] || activity.type;

  return (
    <button
      key={activity.id}
      onClick={() => onOpen(activity)}
      className="w-full text-left flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:shadow-md transition-all"
    >
      {/* Left color bar reflects activity status */}
      <div
        className="w-1 h-10 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusCfg.color }}
      />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#403770] truncate">{activity.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{typeLabel}</span>
          {activity.startDate && (
            <>
              <span className="text-gray-300">&middot;</span>
              <span className="text-xs text-gray-400">{formatTimeShort(activity.startDate)}</span>
            </>
          )}
        </div>
      </div>

      <span
        className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: statusCfg.bgColor, color: statusCfg.color }}
      >
        {statusCfg.label}
      </span>
    </button>
  );
}
