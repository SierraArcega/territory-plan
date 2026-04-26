// src/features/leaderboard/lib/types.ts

export const TIERS = ["freshman", "honor_roll", "deans_list", "valedictorian"] as const;
export type TierName = (typeof TIERS)[number];

/** Tier rank is now just the tier name (no sub-ranks) */
export type TierRank = TierName;

export const TIER_COLORS: Record<TierName, { bg: string; text: string; glow: string }> = {
  freshman:       { bg: "#F7F5FA", text: "#8A80A8", glow: "rgba(138,128,168,0.3)" },
  honor_roll:     { bg: "#FEF2F1", text: "#F37167", glow: "rgba(243,113,103,0.3)" },
  deans_list:     { bg: "#EEF4F9", text: "#5B8FAF", glow: "rgba(91,143,175,0.3)" },
  valedictorian:  { bg: "#FFF8EE", text: "#D4A843", glow: "rgba(212,168,67,0.3)" },
};

export const TIER_LABELS: Record<TierName, string> = {
  freshman: "Freshman",
  honor_roll: "Honor Roll",
  deans_list: "Dean's List",
  valedictorian: "Valedictorian",
};

export function parseTierRank(tierRank: string): { tier: TierName } {
  // Handle legacy "tier_N" format by stripping the sub-rank
  const tier = tierRank.replace(/_\d$/, "") as TierName;
  return { tier: TIERS.includes(tier) ? tier : "freshman" };
}

export function formatTierLabel(tierRank: string): string {
  const { tier } = parseTierRank(tierRank);
  return TIER_LABELS[tier];
}

export interface PointBreakdownItem {
  action: string;
  label: string;
  pointValue: number;
  count: number;
  total: number;
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
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  // Revenue: legacy scalar (used by scoring) + per-FY pair (client toggle)
  revenue: number;
  revenueCurrentFY: number;
  revenuePriorFY: number;
  // Min Purchases: legacy alias (priorYearRevenue) + per-FY pair
  priorYearRevenue: number;
  minPurchasesCurrentFY: number;
  minPurchasesPriorFY: number;
  revenueTargeted: number;
  targetedCurrentFY: number;
  targetedNextFY: number;
  combinedScore: number;
  initiativeScore: number;
  pointBreakdown: PointBreakdownItem[];
}

export interface LeaderboardMyRank {
  userId: string;
  initiativeName: string;
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

export interface InitiativeInfo {
  id: number;
  name: string;
  startDate: string;
  endDate: string | null;
  showName: boolean;
  showDates: boolean;
  initiativeWeight: number;
  pipelineWeight: number;
  takeWeight: number;
  revenueWeight: number;
  revenueTargetedWeight: number;
  revenueTargetedFiscalYear: string | null;
  pipelineFiscalYear: string | null;
  takeFiscalYear: string | null;
  revenueFiscalYear: string | null;
}

export type LeaderboardView = "combined" | "initiative" | "pipeline" | "take" | "revenue" | "revenueTargeted";
