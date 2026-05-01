// src/features/leaderboard/lib/types.ts

export interface LeaderboardEntry {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
  rank: number;
  take: number;
  pipeline: number;
  pipelineCurrentFY: number;
  pipelineNextFY: number;
  // Revenue: legacy scalar + per-FY pair (client toggle)
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
}

export interface RevenueRankResponse {
  fy: "current" | "next";
  schoolYear: string;
  rank: number;
  totalReps: number;
  revenue: number;
  bookings: number;
  inRoster: boolean;
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
