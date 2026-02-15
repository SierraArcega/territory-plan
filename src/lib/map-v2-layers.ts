import type { ExpressionSpecification } from "maplibre-gl";

// ============================================
// Vendor definitions
// ============================================

export type VendorId = "fullmind" | "proximity" | "elevate" | "tbt";

export interface VendorConfig {
  id: VendorId;
  label: string;
  /** The tile property that holds this vendor's category */
  tileProperty: string;
  /** Fill color expression: match on category → brand tint/shade */
  fillColor: ExpressionSpecification;
  fillOpacity: number;
  /** Tooltip describing the shading progression */
  shadingTooltip: string;
}

// Fullmind shading: target (lightest) → expansion_pipeline (darkest)
// Plus existing customer categories: lapsed, new, multi_year
// Colors from brand Plum tint/shade table
const FULLMIND_FILL: ExpressionSpecification = [
  "match",
  ["get", "fullmind_category"],
  "target", "#ecebf1",             // Plum 90% tint (lightest)
  "new_pipeline", "#b3afc6",       // Plum 50% tint
  "renewal_pipeline", "#665f8d",   // Plum 20% shade
  "expansion_pipeline", "#403770", // Plum (full)
  "lapsed", "#d9d7e2",             // Plum 80% tint
  "new", "#8c87a9",                // Plum 40% tint
  "multi_year", "#403770",         // Plum (full)
  "rgba(0,0,0,0)",                 // Transparent if no category
];

// Competitor shading: churned (lightest) → multi_year (darkest)
// Colors from brand Coral tint/shade table
const PROXIMITY_FILL: ExpressionSpecification = [
  "match",
  ["get", "proximity_category"],
  "churned", "#fef1f0",   // Coral 90% tint (lightest)
  "new", "#f58d85",        // Coral 20% tint
  "multi_year", "#F37167", // Coral (full)
  "rgba(0,0,0,0)",
];

// Colors from brand Steel Blue tint/shade table
const ELEVATE_FILL: ExpressionSpecification = [
  "match",
  ["get", "elevate_category"],
  "churned", "#f1f6f9",   // Steel Blue 90% tint (lightest)
  "new", "#8bb5cb",        // Steel Blue 20% tint
  "multi_year", "#6EA3BE", // Steel Blue (full)
  "rgba(0,0,0,0)",
];

// Colors from brand Golden tint/shade table
const TBT_FILL: ExpressionSpecification = [
  "match",
  ["get", "tbt_category"],
  "churned", "#fffaf1",   // Golden 90% tint (lightest)
  "new", "#ffd98d",        // Golden 20% tint
  "multi_year", "#FFCF70", // Golden (full)
  "rgba(0,0,0,0)",
];

export const VENDOR_CONFIGS: Record<VendorId, VendorConfig> = {
  fullmind: {
    id: "fullmind",
    label: "Fullmind",
    tileProperty: "fullmind_category",
    fillColor: FULLMIND_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "target \u203a pipeline \u203a renewal \u203a expansion",
  },
  proximity: {
    id: "proximity",
    label: "Proximity Learning",
    tileProperty: "proximity_category",
    fillColor: PROXIMITY_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  elevate: {
    id: "elevate",
    label: "Elevate K12",
    tileProperty: "elevate_category",
    fillColor: ELEVATE_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  tbt: {
    id: "tbt",
    label: "Tutored by Teachers",
    tileProperty: "tbt_category",
    fillColor: TBT_FILL,
    fillOpacity: 0.55,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
};

export const VENDOR_IDS: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];

// ============================================
// Filter helpers
// ============================================

/**
 * Build a combined MapLibre filter expression from active filters.
 * Returns null if no filters are active (show all districts).
 */
export function buildFilterExpression(
  filterOwner: string | null,
  filterPlanId: string | null,
): ExpressionSpecification | null {
  const conditions: ExpressionSpecification[] = [];

  if (filterOwner) {
    conditions.push(["==", ["get", "sales_executive"], filterOwner]);
  }

  if (filterPlanId) {
    // plan_ids is comma-separated; use "in" substring match
    conditions.push([
      "!=",
      ["index-of", filterPlanId, ["coalesce", ["get", "plan_ids"], ""]],
      -1,
    ]);
  }

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];
  return ["all", ...conditions] as ExpressionSpecification;
}
