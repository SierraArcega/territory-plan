"use client";

import type { ActivityListItem } from "@/features/shared/types/api-types";
import { ACTIVITY_TYPE_LABELS } from "@/features/activities/types";

interface ActivityTimelineItemProps {
  activity: ActivityListItem;
}

const SOURCE_CONFIG: Record<
  string,
  { bg: string; label: string }
> = {
  gmail_sync: { bg: "bg-[#EA4335]", label: "G" },
  calendar_sync: { bg: "bg-[#4285F4]", label: "C" },
  slack_sync: { bg: "bg-[#4A154B]", label: "S" },
  manual: { bg: "bg-gray-400", label: "M" },
};

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function ActivityTimelineItem({
  activity,
}: ActivityTimelineItemProps) {
  const source = SOURCE_CONFIG[activity.source] || SOURCE_CONFIG.manual;
  const typeLabel =
    ACTIVITY_TYPE_LABELS[activity.type] || activity.type;

  // Mixmax fields (populated by Mixmax sync engine)
  const {
    mixmaxSequenceName,
    mixmaxSequenceStep,
    mixmaxSequenceTotalSteps,
    mixmaxOpenCount,
    mixmaxClickCount,
  } = activity;

  return (
    <div className="flex gap-3 relative">
      {/* Left: Source icon on the timeline line */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-[22px] h-[22px] rounded-full flex items-center justify-center text-white text-[10px] font-bold ${source.bg}`}
        >
          {source.label}
        </div>
      </div>

      {/* Right: Card */}
      <div className="flex-1 border border-gray-200 rounded-lg p-3 min-w-0">
        {/* Title line */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-gray-400 uppercase tracking-wide">
            {typeLabel}
          </span>
          <span className="text-sm font-semibold text-gray-800 truncate">
            {activity.title}
          </span>
        </div>

        {/* Mixmax sequence badge */}
        {mixmaxSequenceName && (
          <div className="mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#FFF3F0] text-[#FF6B4A]">
              {mixmaxSequenceStep != null && mixmaxSequenceTotalSteps != null
                ? `Step ${mixmaxSequenceStep}/${mixmaxSequenceTotalSteps}`
                : "Sequence"}{" "}
              &middot; {mixmaxSequenceName}
            </span>
          </div>
        )}

        {/* Detail line */}
        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-500">
          {activity.districtCount > 0 && (
            <span>
              {activity.districtCount} district{activity.districtCount !== 1 ? "s" : ""}
            </span>
          )}
          {activity.stateAbbrevs.length > 0 && (
            <>
              {activity.districtCount > 0 && <span>&middot;</span>}
              <span>{activity.stateAbbrevs.join(", ")}</span>
            </>
          )}
          {activity.startDate && (
            <>
              {(activity.districtCount > 0 || activity.stateAbbrevs.length > 0) && (
                <span>&middot;</span>
              )}
              <span>{formatTime(activity.startDate)}</span>
            </>
          )}
        </div>

        {/* Mixmax engagement stats */}
        {(mixmaxOpenCount != null && mixmaxOpenCount > 0) ||
        (mixmaxClickCount != null && mixmaxClickCount > 0) ? (
          <div className="mt-1 text-[11px] text-gray-400">
            {mixmaxOpenCount != null && mixmaxOpenCount > 0 && (
              <span>Opened {mixmaxOpenCount}x</span>
            )}
            {mixmaxOpenCount != null &&
              mixmaxOpenCount > 0 &&
              mixmaxClickCount != null &&
              mixmaxClickCount > 0 && <span> &middot; </span>}
            {mixmaxClickCount != null && mixmaxClickCount > 0 && (
              <span>Clicked {mixmaxClickCount}x</span>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
