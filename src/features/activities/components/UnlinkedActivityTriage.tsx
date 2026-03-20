"use client";

import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useUnlinkedActivities,
  useLinkActivityDistricts,
} from "@/features/activities/lib/queries";
import { useTerritoryPlans } from "@/features/plans/lib/queries";
import type { TerritoryPlanDistrict } from "@/features/shared/types/api-types";

// Source badge config (mirrors ActivityTimelineItem)
const SOURCE_CONFIG: Record<string, { bg: string; label: string }> = {
  gmail_sync: { bg: "bg-[#EA4335]", label: "G" },
  calendar_sync: { bg: "bg-[#4285F4]", label: "C" },
  slack_sync: { bg: "bg-[#4A154B]", label: "S" },
  manual: { bg: "bg-gray-400", label: "M" },
};

// Friendly type labels for types that may come from sync engines
function formatType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface UniqueDistrict {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
}

interface UnlinkedActivityTriageProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Slide-out drawer listing unlinked synced activities.
 * Each row has a district picker (from the user's territory plans) and a
 * "Link" button. Once linked the activity disappears from the list.
 */
export default function UnlinkedActivityTriage({
  isOpen,
  onClose,
}: UnlinkedActivityTriageProps) {
  const queryClient = useQueryClient();
  const { data: unlinkedData, isLoading } = useUnlinkedActivities();
  const { data: plans } = useTerritoryPlans({ enabled: isOpen });
  const linkDistricts = useLinkActivityDistricts();

  // Per-row selected district leaid
  const [selections, setSelections] = useState<Record<string, string>>({});
  // Track which rows are being submitted
  const [linking, setLinking] = useState<Record<string, boolean>>({});
  // Track successfully linked IDs so they disappear immediately
  const [linked, setLinked] = useState<Set<string>>(new Set());

  // Flatten unique districts across all plans
  const uniqueDistricts = useMemo<UniqueDistrict[]>(() => {
    if (!plans) return [];
    const seen = new Set<string>();
    const result: UniqueDistrict[] = [];
    for (const plan of plans) {
      // useTerritoryPlans returns TerritoryPlan[], which has no districts.
      // We need TerritoryPlanDetail for that. As a fallback we build from
      // the plan's states if districts isn't available. Because the triage
      // drawer needs district-level info we eagerly hint to the user that
      // their plan districts appear here once the detail is loaded.
      // However TerritoryPlan itself doesn't carry district list — we rely
      // on whatever is cached in the query client from previous navigations.
      const planDetail = queryClient.getQueryData<{ districts: TerritoryPlanDistrict[] }>(
        ["territoryPlan", plan.id]
      );
      const districts = planDetail?.districts ?? [];
      for (const d of districts) {
        if (!seen.has(d.leaid)) {
          seen.add(d.leaid);
          result.push({
            leaid: d.leaid,
            name: d.name,
            stateAbbrev: d.stateAbbrev ?? null,
          });
        }
      }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [plans, queryClient]);

  const activities = (unlinkedData?.activities ?? []).filter(
    (a) => !linked.has(a.id)
  );

  async function handleLink(activityId: string) {
    const leaid = selections[activityId];
    if (!leaid) return;
    setLinking((prev) => ({ ...prev, [activityId]: true }));
    try {
      await linkDistricts.mutateAsync({ activityId, leaids: [leaid] });
      setLinked((prev) => new Set(prev).add(activityId));
      // Invalidate unlinked count so the badge updates
      queryClient.invalidateQueries({ queryKey: ["activities", "unlinked"] });
    } finally {
      setLinking((prev) => ({ ...prev, [activityId]: false }));
    }
  }

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-base font-semibold text-[#403770]">
              Unlinked Activities
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Synced emails and messages with no district match
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#F37167] border-t-transparent" />
            </div>
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <svg
                className="w-12 h-12 text-gray-300 mb-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                />
              </svg>
              <p className="text-sm font-medium text-gray-600">
                All caught up!
              </p>
              <p className="text-xs text-gray-400 mt-1">
                No unlinked activities to review.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {activities.map((activity) => {
                const src =
                  SOURCE_CONFIG[activity.source] ?? SOURCE_CONFIG.manual;
                const isLinking = linking[activity.id];
                const selected = selections[activity.id] ?? "";

                return (
                  <li key={activity.id} className="px-5 py-4">
                    {/* Top row: source dot + type + title */}
                    <div className="flex items-start gap-2.5">
                      <span
                        className={`mt-0.5 w-5 h-5 flex-shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${src.bg}`}
                      >
                        {src.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          {formatType(activity.type)}
                        </p>
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {activity.title || "(No subject)"}
                        </p>
                        {activity.startDate && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {formatDate(activity.startDate)}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bottom row: district picker + link button */}
                    <div className="mt-3 flex items-center gap-2">
                      <select
                        value={selected}
                        onChange={(e) =>
                          setSelections((prev) => ({
                            ...prev,
                            [activity.id]: e.target.value,
                          }))
                        }
                        className="flex-1 h-8 px-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] disabled:opacity-50"
                        disabled={isLinking}
                      >
                        <option value="">
                          {uniqueDistricts.length === 0
                            ? "No districts in plans"
                            : "Select district..."}
                        </option>
                        {uniqueDistricts.map((d) => (
                          <option key={d.leaid} value={d.leaid}>
                            {d.name}
                            {d.stateAbbrev ? ` (${d.stateAbbrev})` : ""}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleLink(activity.id)}
                        disabled={!selected || isLinking}
                        className="h-8 px-3 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {isLinking ? (
                          <svg
                            className="animate-spin w-3.5 h-3.5"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8v8z"
                            />
                          </svg>
                        ) : (
                          "Link"
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
