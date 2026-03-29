"use client";

import { Fragment, useState } from "react";
import { useLeaderboardDetails } from "../lib/queries";
import { TIER_LABELS, TIER_COLORS, parseTierRank } from "../lib/types";
import TierBadge from "./TierBadge";
import type { TierName } from "../lib/types";

const ACTION_TAB_MAP: Record<string, string> = {
  plan_created: "plans",
  activity_logged: "activities",
  revenue_targeted: "plans",
};

export default function LeaderboardDetailView() {
  const { data, isLoading, isError } = useLeaderboardDetails();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="space-y-4">
            <div className="h-8 w-48 bg-[#E2DEEC]/40 rounded animate-pulse" />
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-14 bg-[#E2DEEC]/40 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-[#F37167]">Failed to load leaderboard details.</p>
      </div>
    );
  }

  const { entries, metrics } = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#403770]">Leaderboard</h1>
          <p className="text-sm text-[#8A80A8] mt-1">
            Point breakdown by rep &mdash; click a row to see details
          </p>
        </div>

        {/* Table */}
        <div className="border border-[#D4CFE2] rounded-xl bg-white overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F7F5FA] border-b border-[#E2DEEC]">
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide w-12">
                  #
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide">
                  Rep
                </th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide w-28">
                  Tier
                </th>
                {metrics.map((m) => (
                  <th
                    key={m.action}
                    className="text-right px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide w-28"
                  >
                    {m.label}
                  </th>
                ))}
                <th className="text-right px-4 py-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wide w-24">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const isExpanded = expandedUser === entry.userId;
                const tierKey = parseTierRank(entry.tier).tier;
                const colors = TIER_COLORS[tierKey];

                return (
                  <Fragment key={entry.userId}>
                    <tr
                      onClick={() =>
                        setExpandedUser(isExpanded ? null : entry.userId)
                      }
                      className="border-t border-[#E2DEEC] hover:bg-[#EFEDF5] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-bold text-[#403770]">
                        {entry.rank}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {entry.avatarUrl ? (
                            <img
                              src={entry.avatarUrl}
                              alt={entry.fullName}
                              className="w-8 h-8 rounded-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#F37167] flex items-center justify-center">
                              <span className="text-xs font-bold text-white">
                                {entry.fullName
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            </div>
                          )}
                          <span className="text-sm font-medium text-[#403770]">
                            {entry.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <TierBadge tierRank={entry.tier} size="sm" />
                      </td>
                      {entry.breakdown.map((b) => (
                        <td
                          key={b.action}
                          className="px-4 py-3 text-right text-sm text-[#6E6390]"
                        >
                          <span className="font-medium text-[#403770]">
                            {b.total}
                          </span>
                          <span className="text-[#A69DC0] ml-1 text-xs">
                            ({b.count})
                          </span>
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-bold text-[#403770]">
                          {entry.totalPoints} pts
                        </span>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr className="bg-[#F7F5FA]">
                        <td colSpan={3 + metrics.length + 1} className="px-6 py-4">
                          <div className="space-y-4">
                            {entry.breakdown.map((b) => {
                              const itemsForAction = entry.items.filter(
                                (item) => item.action === b.action
                              );
                              return (
                                <div key={b.action}>
                                  {/* Section header */}
                                  <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wide">
                                      {b.label}
                                    </span>
                                    <span className="text-xs text-[#A69DC0]">
                                      {b.count} &times; {b.pointValue} pts = {b.total} pts
                                    </span>
                                  </div>

                                  {/* Individual items table */}
                                  {itemsForAction.length > 0 ? (
                                    <div className="bg-white rounded-lg border border-[#E2DEEC] overflow-hidden">
                                      <table className="w-full">
                                        <tbody>
                                          {itemsForAction.map((item) => (
                                            <tr
                                              key={`${item.action}-${item.id}`}
                                              className="border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#EFEDF5] transition-colors"
                                            >
                                              <td className="px-4 py-2 text-sm text-[#403770]">
                                                {item.title}
                                              </td>
                                              {item.type && (
                                                <td className="px-4 py-2 text-xs text-[#8A80A8] w-24">
                                                  {item.type}
                                                </td>
                                              )}
                                              <td className="px-4 py-2 text-xs text-[#A69DC0] text-right w-32">
                                                {new Date(item.date).toLocaleDateString("en-US", {
                                                  month: "short",
                                                  day: "numeric",
                                                  year: "numeric",
                                                })}
                                              </td>
                                              <td className="px-4 py-2 text-right text-xs font-medium text-[#403770] w-16">
                                                +{b.pointValue}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ) : b.action === "revenue_targeted" && b.count > 0 ? (
                                    <div className="bg-white rounded-lg border border-[#E2DEEC] px-4 py-2 text-sm text-[#8A80A8]">
                                      {b.count} units of $10K targeted across plan districts
                                    </div>
                                  ) : (
                                    <div className="text-xs text-[#A69DC0] italic">
                                      No items
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          {entries.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-[#8A80A8]">
                No scores yet. Start earning points!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
