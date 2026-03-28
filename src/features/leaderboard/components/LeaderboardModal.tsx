"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { useLeaderboard, useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import { parseTierRank } from "../lib/types";
import type { LeaderboardView, TierRank, LeaderboardEntry } from "../lib/types";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

const VIEW_OPTIONS: { value: LeaderboardView; label: string }[] = [
  { value: "combined", label: "Combined" },
  { value: "season", label: "Season Points" },
  { value: "take", label: "Take" },
];

export default function LeaderboardModal({ isOpen, onClose }: LeaderboardModalProps) {
  const [view, setView] = useState<LeaderboardView>("combined");
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard();
  const { data: myRank } = useMyLeaderboardRank();

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Sort entries by the active view
  const sortedEntries = [...(leaderboard?.entries ?? [])].sort((a, b) => {
    if (view === "combined") return b.combinedScore - a.combinedScore;
    if (view === "season") return b.totalPoints - a.totalPoints;
    return b.take - a.take;
  });

  // Re-rank after sorting
  const rankedEntries = sortedEntries.map((entry, i) => ({
    ...entry,
    displayRank: i + 1,
  }));

  const getScore = (entry: LeaderboardEntry): string => {
    if (view === "combined") return `${entry.combinedScore.toFixed(1)}`;
    if (view === "season") return `${entry.totalPoints} pts`;
    return formatCurrency(entry.take);
  };

  const getTierForEntry = (entry: LeaderboardEntry): string => {
    return parseTierRank(entry.tier as TierRank).tier;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#403770]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        style={{ animation: "modal-in 200ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E2DEEC]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-xl font-bold text-plum">
              {leaderboard?.season.name ?? "Leaderboard"}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8A80A8] hover:text-plum hover:bg-[#F7F5FA] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {leaderboard?.season && (
            <p className="text-xs text-[#8A80A8]">
              {formatDate(leaderboard.season.startDate)} — {formatDate(leaderboard.season.endDate)}
            </p>
          )}

          {/* View toggle pills */}
          <div className="flex gap-1.5 mt-4">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setView(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  view === opt.value
                    ? "bg-plum text-white"
                    : "bg-[#F7F5FA] text-[#8A80A8] hover:text-plum"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* My rank card (pinned) */}
        {myRank && (
          <div className="px-6 py-4 bg-[#F7F5FA] border-b border-[#E2DEEC]">
            <div className="flex items-center gap-3">
              <TierBadge tierRank={(myRank.tier ?? "iron_3") as TierRank} size="lg" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-plum">
                    #{myRank.rank}
                  </span>
                  <span className="text-xs text-[#8A80A8]">
                    of {myRank.totalReps} reps
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {myRank.pointBreakdown.map((b) => (
                    <span key={b.action} className="text-[10px] text-[#8A80A8]">
                      {b.count} {b.label.toLowerCase()} x {b.pointValue}pts = {b.total}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-lg font-bold text-plum">
                {myRank.totalPoints} pts
              </span>
            </div>
          </div>
        )}

        {/* Rankings table */}
        <div className="flex-1 overflow-y-auto">
          {lbLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-plum border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="divide-y divide-[#E2DEEC]">
              {rankedEntries.map((entry, i) => {
                const currentTier = getTierForEntry(entry);
                const prevTier = i > 0 ? getTierForEntry(rankedEntries[i - 1]) : null;
                const showDivider = prevTier !== null && prevTier !== currentTier;
                const isMe = myRank ? entry.userId === myRank.rank.toString() : false;

                return (
                  <div key={entry.userId}>
                    {/* Tier boundary divider */}
                    {showDivider && (
                      <div className="flex items-center gap-2 px-6 py-1.5 bg-[#F7F5FA]">
                        <div className="h-px flex-1 bg-[#E2DEEC]" />
                        <span className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
                          {currentTier}
                        </span>
                        <div className="h-px flex-1 bg-[#E2DEEC]" />
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-3 px-6 py-3 transition-colors ${
                        isMe ? "bg-[#F7F5FA]" : "hover:bg-[#FAFAFA]"
                      }`}
                    >
                      {/* Rank */}
                      <span className="w-8 text-sm font-bold text-plum text-right">
                        #{entry.displayRank}
                      </span>

                      {/* Avatar */}
                      {entry.avatarUrl ? (
                        <img
                          src={entry.avatarUrl}
                          alt={entry.fullName}
                          className="w-8 h-8 rounded-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-coral flex items-center justify-center">
                          <span className="text-xs font-bold text-white">
                            {entry.fullName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)}
                          </span>
                        </div>
                      )}

                      {/* Name */}
                      <span className="flex-1 text-sm font-medium text-plum truncate">
                        {entry.fullName}
                      </span>

                      {/* Tier badge */}
                      <TierBadge tierRank={entry.tier as TierRank} size="sm" />

                      {/* Score */}
                      <span className="w-20 text-right text-sm font-semibold text-plum">
                        {getScore(entry)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
