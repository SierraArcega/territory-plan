/**
 * Cross-year comparison logic: transition bucket classification.
 *
 * Maps a (categoryA, categoryB) pair to one of 6 buckets representing
 * how a district's vendor engagement changed between two fiscal years.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TransitionBucket =
  | "churned"
  | "new_customer"
  | "upgraded"
  | "downgraded"
  | "new_pipeline"
  | "unchanged";

export interface TransitionBucketConfig {
  id: TransitionBucket;
  label: string;
  color: string;
  description: string;
}

export const TRANSITION_BUCKETS: TransitionBucketConfig[] = [
  { id: "churned", label: "Churned", color: "#F37167", description: "Customer in FY_A, lost in FY_B" },
  { id: "new_customer", label: "New Customer", color: "#4ECDC4", description: "No revenue in FY_A, paying customer in FY_B" },
  { id: "upgraded", label: "Upgraded", color: "#6EA3BE", description: "Higher engagement in FY_B" },
  { id: "downgraded", label: "Downgraded", color: "#FFCF70", description: "Lower engagement in FY_B" },
  { id: "new_pipeline", label: "New Pipeline", color: "#C4E7E6", description: "No data/lapsed/churned in FY_A, pipeline in FY_B" },
  { id: "unchanged", label: "Unchanged", color: "#E5E7EB", description: "Same category in both FYs" },
];

/** Quick lookup: bucket id -> config */
export const TRANSITION_BUCKET_MAP: Record<TransitionBucket, TransitionBucketConfig> =
  Object.fromEntries(TRANSITION_BUCKETS.map((b) => [b.id, b])) as Record<TransitionBucket, TransitionBucketConfig>;

// ---------------------------------------------------------------------------
// Category hierarchy
// ---------------------------------------------------------------------------

/**
 * Rank hierarchy for engagement categories. Higher rank = deeper engagement.
 * Both `lapsed` (Fullmind) and `churned` (competitor vendors) are ranked 0.
 */
export const CATEGORY_RANK: Record<string, number> = {
  "": 0,
  lapsed: 0,
  churned: 0,
  target: 1,
  new_business_pipeline: 2,
  winback_pipeline: 3,
  renewal_pipeline: 4,
  expansion_pipeline: 5,
  new: 6,
  multi_year_shrinking: 7,
  multi_year_flat: 8,
  multi_year_growing: 9,
};

const CUSTOMER_CATEGORIES = new Set([
  "new",
  "multi_year_growing",
  "multi_year_flat",
  "multi_year_shrinking",
]);

const PIPELINE_CATEGORIES = new Set([
  "target",
  "new_business_pipeline",
  "winback_pipeline",
  "renewal_pipeline",
  "expansion_pipeline",
]);

const NO_DATA_CATEGORIES = new Set(["", "lapsed", "churned"]);

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/** Normalize null / undefined / empty string to "" for consistent comparison */
function normalize(cat: string | null | undefined): string {
  return cat ?? "";
}

/**
 * Classify the transition between two fiscal years' categories into a bucket.
 * Rules are evaluated in order -- first match wins.
 */
export function classifyTransition(
  categoryA: string | null | undefined,
  categoryB: string | null | undefined,
): TransitionBucket {
  const a = normalize(categoryA);
  const b = normalize(categoryB);

  // 1. Unchanged: same category in both (including both null/empty)
  if (a === b) return "unchanged";

  const rankA = CATEGORY_RANK[a] ?? 0;
  const rankB = CATEGORY_RANK[b] ?? 0;

  // 2. Churned: had engagement in A (rank >= 1), null/lapsed/churned in B
  if (rankA >= 1 && NO_DATA_CATEGORIES.has(b)) {
    return "churned";
  }

  // 3. New Customer: was null/target/lapsed/churned/pipeline in A, customer category in B
  if (
    (NO_DATA_CATEGORIES.has(a) || PIPELINE_CATEGORIES.has(a)) &&
    CUSTOMER_CATEGORIES.has(b)
  ) {
    return "new_customer";
  }

  // 4. New Pipeline: null/lapsed/churned in A, pipeline category in B
  if (NO_DATA_CATEGORIES.has(a) && PIPELINE_CATEGORIES.has(b)) {
    return "new_pipeline";
  }

  // 5. Upgraded: both have rank >= 1, rank(B) > rank(A)
  if (rankA >= 1 && rankB >= 1 && rankB > rankA) {
    return "upgraded";
  }

  // 6. Downgraded: both have rank >= 1, rank(B) < rank(A), B is not lapsed/churned/null
  if (rankA >= 1 && rankB >= 1 && rankB < rankA && !NO_DATA_CATEGORIES.has(b)) {
    return "downgraded";
  }

  // Fallback
  return "unchanged";
}
