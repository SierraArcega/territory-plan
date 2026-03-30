"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, Trophy, Target, TrendingUp, DollarSign, Zap } from "lucide-react";
import { useLeaderboard, useMyLeaderboardRank } from "../lib/queries";
import TierBadge from "./TierBadge";
import { parseTierRank, TIER_LABELS, TIERS, TIER_COLORS } from "../lib/types";
import type { LeaderboardView, LeaderboardEntry, TierName } from "../lib/types";

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDetails?: () => void;
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

const VIEW_CONFIG: {
  value: LeaderboardView;
  label: string;
  icon: typeof Trophy;
  description: string;
}[] = [
  {
    value: "combined",
    label: "Combined",
    icon: Zap,
    description: "Weighted blend of initiative points, pipeline, take, and revenue — normalized across all reps.",
  },
  {
    value: "initiative",
    label: "Initiative Points",
    icon: Target,
    description: "Points earned from tracked actions: creating plans, logging activities, and targeting revenue.",
  },
  {
    value: "take",
    label: "Take",
    icon: DollarSign,
    description: "Total take (net revenue after costs) from closed opportunities in the selected fiscal year.",
  },
];

export default function LeaderboardModal({ isOpen, onClose, onNavigateToDetails }: LeaderboardModalProps) {
  const [view, setView] = useState<LeaderboardView>("combined");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboard();
  const { data: myRank } = useMyLeaderboardRank();

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Collapse expanded rows when switching tabs
  useEffect(() => {
    setExpandedUser(null);
  }, [view]);

  if (!isOpen) return null;

  const initiative = leaderboard?.initiative;
  const weights = initiative
    ? {
        initiative: Math.round(initiative.initiativeWeight * 100),
        pipeline: Math.round(initiative.pipelineWeight * 100),
        take: Math.round(initiative.takeWeight * 100),
        revenue: Math.round(initiative.revenueWeight * 100),
      }
    : { initiative: 40, pipeline: 20, take: 20, revenue: 20 };

  // Sort entries by the active view
  const sortedEntries = [...(leaderboard?.entries ?? [])].sort((a, b) => {
    if (view === "combined") return b.combinedScore - a.combinedScore;
    if (view === "initiative") return b.totalPoints - a.totalPoints;
    return b.take - a.take;
  });

  const rankedEntries = sortedEntries.map((entry, i) => ({
    ...entry,
    displayRank: i + 1,
  }));

  const getScore = (entry: LeaderboardEntry): string => {
    if (view === "combined") return entry.combinedScore.toFixed(1);
    if (view === "initiative") return `${entry.totalPoints} pts`;
    return formatCurrency(entry.take);
  };

  const getTierForEntry = (entry: LeaderboardEntry): string => {
    return parseTierRank(entry.tier).tier;
  };

  const tierThresholdMap = new Map<string, number>();
  if (leaderboard?.thresholds) {
    for (const t of leaderboard.thresholds) {
      tierThresholdMap.set(t.tier, t.minPoints);
    }
  }

  const activeViewConfig = VIEW_CONFIG.find((v) => v.value === view)!;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-[#403770]/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        style={{ animation: "modal-in 200ms ease-out" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E2DEEC]">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-[#D4A843]" />
              <h2 className="text-xl font-bold text-[#403770]">
                {initiative?.showName !== false
                  ? (initiative?.name ?? "Leaderboard")
                  : "Leaderboard"}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8A80A8] hover:text-[#403770] hover:bg-[#F7F5FA] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          {initiative && initiative.showDates !== false && initiative.endDate && (
            <p className="text-xs text-[#8A80A8] ml-7.5">
              {formatDate(initiative.startDate)} — {formatDate(initiative.endDate)}
            </p>
          )}

          {/* Tab pills + details link */}
          <div className="flex items-center justify-between mt-4">
            <div className="flex gap-1.5">
              {VIEW_CONFIG.map((opt) => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setView(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      view === opt.value
                        ? "bg-[#403770] text-white"
                        : "bg-[#F7F5FA] text-[#8A80A8] hover:text-[#403770]"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            {onNavigateToDetails && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToDetails();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#403770] bg-[#F7F5FA] hover:bg-[#EFEDF5] transition-colors"
              >
                Show me details
              </button>
            )}
          </div>

          {/* View description */}
          <p className="mt-3 text-xs text-[#6E6390] leading-relaxed">
            {activeViewConfig.description}
            {view === "combined" && (
              <span className="text-[#8A80A8]">
                {" "}Current weights: Initiative {weights.initiative}%, Pipeline {weights.pipeline}%, Take {weights.take}%, Revenue {weights.revenue}%.
              </span>
            )}
          </p>
        </div>

        {/* My rank card */}
        {myRank && (
          <div className="px-6 py-3.5 bg-[#F7F5FA] border-b border-[#E2DEEC]">
            <div className="flex items-center gap-3">
              <TierBadge tierRank={myRank.tier ?? "freshman"} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-[#403770]">
                    #{myRank.rank}
                  </span>
                  <span className="text-xs text-[#8A80A8]">
                    of {myRank.totalReps} reps
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                  {myRank.pointBreakdown.map((b) => (
                    <span key={b.action} className="text-[10px] text-[#8A80A8]">
                      {b.count} {b.label.toLowerCase()} x {b.pointValue}pts = {b.total}
                    </span>
                  ))}
                </div>
              </div>
              <span className="text-lg font-bold text-[#403770]">
                {myRank.totalPoints} pts
              </span>
            </div>
          </div>
        )}

        {/* Rankings */}
        <div className="flex-1 overflow-y-auto">
          {lbLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-[#403770] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div>
              {[...TIERS].reverse().map((tierKey) => {
                const tierEntries = rankedEntries.filter(
                  (e) => getTierForEntry(e) === tierKey
                );
                const tierLabel = TIER_LABELS[tierKey];
                const minPoints = tierThresholdMap.get(tierKey);
                const colors = TIER_COLORS[tierKey];

                return (
                  <div key={tierKey}>
                    {/* Tier divider */}
                    <div className="flex items-center gap-2 px-6 py-2 bg-[#F7F5FA] border-b border-[#E2DEEC]">
                      <div className="h-px flex-1 bg-[#E2DEEC]" />
                      <span
                        className="text-[10px] font-semibold tracking-wider"
                        style={{ color: colors.text }}
                      >
                        {tierLabel}
                        {minPoints != null && (
                          <span className="font-normal text-[#8A80A8] ml-1">
                            ({minPoints}+ pts)
                          </span>
                        )}
                      </span>
                      <div className="h-px flex-1 bg-[#E2DEEC]" />
                    </div>

                    {tierEntries.length === 0 ? (
                      <div className="px-6 py-4 text-center">
                        <span className="text-xs text-[#8A80A8] italic">
                          No reps yet — be the first to reach {tierLabel}!
                        </span>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#E2DEEC]">
                        {tierEntries.map((entry) => {
                          const isExpanded = expandedUser === entry.userId;

                          return (
                            <div key={entry.userId}>
                              {/* Main row */}
                              <button
                                onClick={() =>
                                  setExpandedUser(isExpanded ? null : entry.userId)
                                }
                                className="w-full flex items-center gap-3 px-6 py-3 transition-colors hover:bg-[#FAFAFA] text-left"
                              >
                                <span className="w-8 text-sm font-bold text-[#403770] text-right">
                                  #{entry.displayRank}
                                </span>

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

                                <span className="flex-1 text-sm font-medium text-[#403770] truncate">
                                  {entry.fullName}
                                </span>

                                <TierBadge tierRank={entry.tier} size="sm" />

                                <span className="w-20 text-right text-sm font-semibold text-[#403770]">
                                  {getScore(entry)}
                                </span>

                                <ChevronDown
                                  className={`w-4 h-4 text-[#A69DC0] transition-transform ${
                                    isExpanded ? "rotate-180" : ""
                                  }`}
                                />
                              </button>

                              {/* Expanded breakdown */}
                              {isExpanded && (
                                <div className="px-6 pb-3 pt-0">
                                  <div className="ml-11 rounded-xl bg-[#F7F5FA] p-4">
                                    {view === "initiative" ? (
                                      /* Initiative Points breakdown — show what actions earned points */
                                      <div className="space-y-2">
                                        {(entry.pointBreakdown ?? []).map((b) => {
                                          const isRevenue = b.action === "revenue_targeted";
                                          const revenueDollars = isRevenue ? b.count * 10000 : 0;

                                          return (
                                            <div
                                              key={b.action}
                                              className="flex items-center justify-between"
                                            >
                                              <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-md bg-[#403770]/10 flex items-center justify-center">
                                                  <Target className="w-3.5 h-3.5 text-[#403770]" />
                                                </div>
                                                <div>
                                                  <span className="text-xs font-medium text-[#403770]">
                                                    {b.label}
                                                  </span>
                                                  {isRevenue ? (
                                                    <span className="text-[10px] text-[#8A80A8] ml-1.5">
                                                      {formatCurrency(revenueDollars)} targeted ÷ $10K = {b.count} units x {b.pointValue} pts
                                                    </span>
                                                  ) : (
                                                    <span className="text-[10px] text-[#8A80A8] ml-1.5">
                                                      {b.count} x {b.pointValue} pts
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                              <span className="text-xs font-semibold text-[#403770]">
                                                {b.total} pts
                                              </span>
                                            </div>
                                          );
                                        })}
                                        <div className="pt-2 mt-1 border-t border-[#E2DEEC] flex items-center justify-between">
                                          <span className="text-xs font-semibold text-[#403770]">
                                            Total Initiative Points
                                          </span>
                                          <span className="text-sm font-bold text-[#403770]">
                                            {entry.totalPoints} pts
                                          </span>
                                        </div>
                                      </div>
                                    ) : (
                                      /* Combined / Take view — show all score components */
                                      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                                        <ScoreRow
                                          icon={Target}
                                          label="Initiative Points"
                                          value={`${entry.totalPoints} pts`}
                                          weight={weights.initiative}
                                          color="#403770"
                                        />
                                        <ScoreRow
                                          icon={TrendingUp}
                                          label="Pipeline"
                                          value={formatCurrency(entry.pipeline)}
                                          weight={weights.pipeline}
                                          color="#6EA3BE"
                                        />
                                        <ScoreRow
                                          icon={DollarSign}
                                          label="Take"
                                          value={formatCurrency(entry.take)}
                                          weight={weights.take}
                                          color="#69B34A"
                                        />
                                        <ScoreRow
                                          icon={Trophy}
                                          label="Revenue"
                                          value={formatCurrency(entry.revenue)}
                                          weight={weights.revenue}
                                          color="#D4A843"
                                        />
                                        <div className="col-span-2 pt-2 mt-1 border-t border-[#E2DEEC]">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-[#403770]">
                                              Combined Score
                                            </span>
                                            <span className="text-sm font-bold text-[#403770]">
                                              {entry.combinedScore.toFixed(1)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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

function ScoreRow({
  icon: Icon,
  label,
  value,
  weight,
  color,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  weight: number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-6 h-6 rounded-md flex items-center justify-center"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-[#8A80A8]">
          {label}
          <span className="ml-1 text-[#A69DC0]">({weight}%)</span>
        </div>
        <div className="text-xs font-semibold text-[#403770]">{value}</div>
      </div>
    </div>
  );
}
