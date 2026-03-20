"use client";

import { useUnlinkedActivities } from "@/features/activities/lib/queries";

interface UnlinkedActivityBadgeProps {
  onClick: () => void;
}

/**
 * Shows a red notification dot with the count of unlinked (unmatched) synced
 * activities. Renders nothing when count is 0.
 */
export default function UnlinkedActivityBadge({
  onClick,
}: UnlinkedActivityBadgeProps) {
  const { data } = useUnlinkedActivities();
  const count = data?.count ?? 0;

  if (count === 0) return null;

  return (
    <button
      onClick={onClick}
      title={`${count} unlinked activit${count === 1 ? "y" : "ies"} need attention`}
      className="relative inline-flex items-center gap-1.5 px-2 py-1 text-xs font-semibold text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors shadow-sm"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-50" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
      </span>
      {count > 99 ? "99+" : count}
    </button>
  );
}
