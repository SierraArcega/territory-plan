// src/features/leaderboard/lib/types.ts

export const TIERS = ["iron", "bronze", "silver", "gold"] as const;
export type TierName = (typeof TIERS)[number];

export const SUB_RANKS = [3, 2, 1] as const;
export type SubRank = (typeof SUB_RANKS)[number];

/** e.g. "iron_3", "gold_1" */
export type TierRank = `${TierName}_${SubRank}`;

export const TIER_COLORS: Record<TierName, { bg: string; text: string; glow: string }> = {
  iron:   { bg: "#F7F5FA", text: "#8A80A8", glow: "rgba(138,128,168,0.3)" },
  bronze: { bg: "#FEF2F1", text: "#F37167", glow: "rgba(243,113,103,0.3)" },
  silver: { bg: "#EEF4F9", text: "#5B8FAF", glow: "rgba(91,143,175,0.3)" },
  gold:   { bg: "#FFF8EE", text: "#D4A843", glow: "rgba(212,168,67,0.3)" },
};

export const TIER_LABELS: Record<TierName, string> = {
  iron: "Iron",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export function parseTierRank(tierRank: TierRank): { tier: TierName; subRank: SubRank } {
  const [tier, rank] = tierRank.split("_") as [TierName, string];
  return { tier, subRank: parseInt(rank, 10) as SubRank };
}

export function formatTierLabel(tierRank: TierRank): string {
  const { tier, subRank } = parseTierRank(tierRank);
  const romanMap: Record<SubRank, string> = { 3: "III", 2: "II", 1: "I" };
  return `${TIER_LABELS[tier]} ${romanMap[subRank]}`;
}

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  totalPoints: number;
  tier: TierRank;
  rank: number;
  take: number;
  pipeline: number;
  combinedScore: number;
  seasonScore: number;
}

export interface LeaderboardMyRank {
  seasonName: string;
  rank: number;
  totalReps: number;
  totalPoints: number;
  tier: string;
  above: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalPoints: number;
    rank: number;
  } | null;
  below: {
    userId: string;
    fullName: string;
    avatarUrl: string | null;
    totalPoints: number;
    rank: number;
  } | null;
  pointBreakdown: { label: string; action: string; count: number; pointValue: number; total: number }[];
}

export interface SeasonInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  seasonWeight: number;
  pipelineWeight: number;
  takeWeight: number;
}

export type LeaderboardView = "combined" | "season" | "take";
