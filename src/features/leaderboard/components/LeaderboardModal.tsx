"use client";

import { useState, useEffect } from "react";
import { X, ChevronDown, Trophy, Target, TrendingUp, DollarSign, Zap } from "lucide-react";
import { useLeaderboard, useMyLeaderboardRank } from "../lib/queries";
import RevenueOverviewTab from "./RevenueOverviewTab";
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
}[] = [
  { value: "combined", label: "Combined", icon: Zap },
  { value: "initiative", label: "Initiative", icon: Target },
  { value: "pipeline", label: "Pipeline", icon: TrendingUp },
  { value: "take", label: "Take", icon: DollarSign },
  { value: "revenue", label: "Revenue", icon: Trophy },
  { value: "revenueTargeted", label: "Targeted", icon: Target },
];

export default function LeaderboardModal({ isOpen, onClose, onNavigateToDetails }: LeaderboardModalProps) {
  const [activeTab, setActiveTab] = useState<"revenue" | "initiative">("revenue");
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
  }, [activeTab, view]);

  if (!isOpen) return null;

  const initiative = leaderboard?.initiative;
  const weights = initiative
    ? {
        initiative: Math.round(initiative.initiativeWeight * 100),
        pipeline: Math.round(initiative.pipelineWeight * 100),
        take: Math.round(initiative.takeWeight * 100),
        revenue: Math.round(initiative.revenueWeight * 100),
        revenueTargeted: Math.round(initiative.revenueTargetedWeight * 100),
      }
    : { initiative: 40, pipeline: 20, take: 20, revenue: 20, revenueTargeted: 0 };

  // Format fiscal year for display — "2025-26" → "FY26", null → "Current FY"
  const formatFY = (fy: string | null | undefined): string => {
    if (!fy) return "Current FY";
    const parts = fy.split("-");
    return `FY${parts[1] ?? fy}`;
  };

  const fyLabels = {
    pipeline: formatFY(initiative?.pipelineFiscalYear),
    take: formatFY(initiative?.takeFiscalYear),
    revenue: formatFY(initiative?.revenueFiscalYear),
    revenueTargeted: formatFY(initiative?.revenueTargetedFiscalYear),
  };

  // Sort entries by the active view
  const sortedEntries = [...(leaderboard?.entries ?? [])].sort((a, b) => {
    if (view === "combined") return b.combinedScore - a.combinedScore;
    if (view === "initiative") return b.totalPoints - a.totalPoints;
    if (view === "pipeline") return b.pipeline - a.pipeline;
    if (view === "revenue") return b.revenue - a.revenue;
    if (view === "revenueTargeted") return b.revenueTargeted - a.revenueTargeted;
    return b.take - a.take;
  });

  const rankedEntries = sortedEntries.map((entry, i) => ({
    ...entry,
    displayRank: i + 1,
  }));

  const getScore = (entry: LeaderboardEntry): string => {
    if (view === "combined") return entry.combinedScore.toFixed(1);
    if (view === "initiative") return `${entry.totalPoints} pts`;
    if (view === "pipeline") return formatCurrency(entry.pipeline);
    if (view === "revenue") return formatCurrency(entry.revenue);
    if (view === "revenueTargeted") return formatCurrency(entry.revenueTargeted);
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
        {/* Header — sticky above scroll */}
        <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-[#E2DEEC]">
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

          {/* Initiative summary — only visible on initiative tab */}
          {initiative && activeTab === "initiative" && (
            <p className="text-xs text-[#6E6390] leading-relaxed mt-2 ml-7.5">
              Ranked by a weighted blend of{" "}
              {[
                weights.initiative > 0 && "initiative points",
                weights.pipeline > 0 && "pipeline",
                weights.take > 0 && "take",
                weights.revenue > 0 && "revenue",
                weights.revenueTargeted > 0 && "targeted revenue",
              ]
                .filter(Boolean)
                .join(", ")
                .replace(/, ([^,]+)$/, ", and $1")}
              . Use the tabs below to see how each input breaks down.
            </p>
          )}

          {onNavigateToDetails && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => {
                  onClose();
                  onNavigateToDetails();
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#403770] bg-[#F7F5FA] hover:bg-[#EFEDF5] transition-colors"
              >
                Show me details
              </button>
            </div>
          )}
        </div>

        {/* Top-level tabs */}
        <div className="flex-shrink-0 border-b border-[#E2DEEC]">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab("revenue")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "revenue"
                  ? "border-[#403770] text-[#403770]"
                  : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
              }`}
            >
              Revenue Overview
            </button>
            <button
              onClick={() => setActiveTab("initiative")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "initiative"
                  ? "border-[#403770] text-[#403770]"
                  : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
              }`}
            >
              Initiative
            </button>
          </div>
          {activeTab === "initiative" && (
            <>
              {/* Initiative sub-tabs */}
              <div className="flex px-6 border-t border-[#EFEDF5]">
                {VIEW_CONFIG.map((opt) => {
                  const Icon = opt.icon;
                  const isActive = view === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => setView(opt.value)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border-b-2 transition-colors ${
                        isActive
                          ? "border-[#403770] text-[#403770]"
                          : "border-transparent text-[#8A80A8] hover:text-[#6E6390]"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="px-6 py-2 text-[11px] text-[#6E6390] bg-[#F7F5FA] leading-relaxed">
                {view === "combined" && (
                  <>
                    Weighted blend of all metrics, normalized across reps.
                    <span className="text-[#8A80A8]">
                      {" "}Initiative {weights.initiative}% · Pipeline {weights.pipeline}% ({fyLabels.pipeline}) · Take {weights.take}% ({fyLabels.take}) · Revenue {weights.revenue}% ({fyLabels.revenue}){weights.revenueTargeted > 0 && <> · Targeted {weights.revenueTargeted}% ({fyLabels.revenueTargeted})</>}
                    </span>
                  </>
                )}
                {view === "initiative" && "Points from tracked actions — plans created, activities logged, and revenue targeted."}
                {view === "pipeline" && (<>Open pipeline (stages 0–5) from opportunities in <span className="font-medium text-[#403770]">{fyLabels.pipeline}</span>.</>)}
                {view === "take" && (<>Net revenue after costs from closed opportunities in <span className="font-medium text-[#403770]">{fyLabels.take}</span>.</>)}
                {view === "revenue" && (<>Total revenue from opportunities in <span className="font-medium text-[#403770]">{fyLabels.revenue}</span>.</>)}
                {view === "revenueTargeted" && (<>Total revenue targeted in territory plans{fyLabels.revenueTargeted !== "Current FY" ? <> for <span className="font-medium text-[#403770]">{fyLabels.revenueTargeted}</span></> : ""}.</>)}
              </p>
            </>
          )}
        </div>

        {/* Content — scrollable area */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === "revenue" ? (
            <RevenueOverviewTab />
          ) : lbLoading ? (
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
                        {minPoints != null && (view === "combined" || view === "initiative") && (
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
                          const isMe = myRank?.userId === entry.userId;

                          return (
                            <div key={entry.userId}>
                              {/* Main row */}
                              <button
                                onClick={() =>
                                  setExpandedUser(isExpanded ? null : entry.userId)
                                }
                                className={`w-full flex items-center gap-3 px-6 py-3 transition-colors text-left ${
                                  isMe
                                    ? "bg-[#C4E7E6]/20 border-l-3 border-l-[#C4E7E6]"
                                    : "hover:bg-[#FAFAFA]"
                                }`}
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
                                  {isMe && (
                                    <span className="ml-1.5 text-[10px] font-semibold text-[#6EA3BE]">You</span>
                                  )}
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
                                          label={`Pipeline (${fyLabels.pipeline})`}
                                          value={formatCurrency(entry.pipeline)}
                                          weight={weights.pipeline}
                                          color="#6EA3BE"
                                        />
                                        <ScoreRow
                                          icon={DollarSign}
                                          label={`Take (${fyLabels.take})`}
                                          value={formatCurrency(entry.take)}
                                          weight={weights.take}
                                          color="#69B34A"
                                        />
                                        <ScoreRow
                                          icon={Trophy}
                                          label={`Revenue (${fyLabels.revenue})`}
                                          value={formatCurrency(entry.revenue)}
                                          weight={weights.revenue}
                                          color="#D4A843"
                                        />
                                        {weights.revenueTargeted > 0 && (
                                          <ScoreRow
                                            icon={Target}
                                            label={`Targeted (${fyLabels.revenueTargeted})`}
                                            value={formatCurrency(entry.revenueTargeted)}
                                            weight={weights.revenueTargeted}
                                            color="#F37167"
                                          />
                                        )}
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
