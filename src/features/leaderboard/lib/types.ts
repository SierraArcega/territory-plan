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

export type LeaderboardView =
  | "combined"
  | "initiative"
  | "pipeline"
  | "take"
  | "revenue"
  | "revenueTargeted"
  | "increase";

// ---------------------------------------------------------------------------
// Increase Your Targets tab
// ---------------------------------------------------------------------------

export interface IncreaseTargetLastClosedWon {
  repName: string | null;
  repEmail: string | null;
  closeDate: string | null; // ISO
  schoolYr: string | null;
  amount: number | null;
}

export type IncreaseTargetCategory =
  | "missing_renewal"
  | "fullmind_winback"
  | "ek12_winback";

export interface IncreaseTarget {
  leaid: string;
  districtName: string;
  state: string;
  enrollment: number | null;
  lmsId: string | null;
  category: IncreaseTargetCategory;
  fy26Revenue: number;
  fy26CompletedRevenue: number;
  fy26ScheduledRevenue: number;
  fy26SessionCount: number | null;
  fy26SubscriptionCount: number | null;
  fy26OppBookings: number;
  fy26MinBookings: number;
  /** FY25 (or FY24) revenue for win-back categories; 0 for missing_renewal. */
  priorYearRevenue: number;
  priorYearVendor: string | null;
  priorYearFy: string | null;
  inFy27Plan: boolean;
  planIds: string[];
  hasFy27Target: boolean;
  hasFy27Pipeline: boolean;
  fy27OpenPipeline: number;
  /** Alias for inFy27Plan — kept so existing callers compile. */
  inPlan: boolean;
  lastClosedWon: IncreaseTargetLastClosedWon | null;
  productTypes: string[];
  subProducts: string[];
  /** Nullable per-FY total_revenue from district_financials (fullmind vendor, or elevate for ek12_winback). */
  revenueTrend: {
    fy24: number | null;
    fy25: number | null;
    fy26: number | null;
    fy27: number | null;
  };
  /** Heuristic suggested renewal/winback amount; null when no revenue signal. */
  suggestedTarget: number | null;
}

export interface IncreaseTargetsResponse {
  districts: IncreaseTarget[];
  totalRevenueAtRisk: number;
}

/** Bucket on a TerritoryPlanDistrict target field. */
export type IncreaseTargetBucket =
  | "renewal"
  | "winback"
  | "expansion"
  | "newBusiness";

export const INCREASE_TARGET_BUCKET_FIELD: Record<
  IncreaseTargetBucket,
  "renewalTarget" | "winbackTarget" | "expansionTarget" | "newBusinessTarget"
> = {
  renewal: "renewalTarget",
  winback: "winbackTarget",
  expansion: "expansionTarget",
  newBusiness: "newBusinessTarget",
};
