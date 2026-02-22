import type { ExpressionSpecification, CircleLayerSpecification } from "maplibre-gl";
import type { VendorPalette, SignalPalette } from "@/features/map/lib/palettes";

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
  "churned", "#c4dae6",   // Steel Blue 60% tint (visible on gray)
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
    fillOpacity: 0.75,
    shadingTooltip: "target \u203a pipeline \u203a renewal \u203a expansion",
  },
  proximity: {
    id: "proximity",
    label: "Proximity Learning",
    tileProperty: "proximity_category",
    fillColor: PROXIMITY_FILL,
    fillOpacity: 0.75,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  elevate: {
    id: "elevate",
    label: "Elevate K12",
    tileProperty: "elevate_category",
    fillColor: ELEVATE_FILL,
    fillOpacity: 0.8,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
  tbt: {
    id: "tbt",
    label: "Tutored by Teachers",
    tileProperty: "tbt_category",
    fillColor: TBT_FILL,
    fillOpacity: 0.75,
    shadingTooltip: "churned \u203a new \u203a multi-year",
  },
};

export const VENDOR_IDS: VendorId[] = ["fullmind", "proximity", "elevate", "tbt"];

// ============================================
// Signal definitions
// ============================================

export type SignalId = "enrollment" | "ell" | "swd" | "expenditure";

export interface SignalLegendItem {
  label: string;
  color: string;
}

export interface SignalConfig {
  id: SignalId;
  label: string;
  /** The tile property that holds this signal's category */
  tileProperty: string;
  /** Fill color match expression */
  fillColor: ExpressionSpecification;
  fillOpacity: number;
  /** Legend items for the inline legend */
  legendItems: SignalLegendItem[];
}

// Growth signals: Mint shades (positive) → Steel Blue (stable) → Coral shades (negative)
const ENROLLMENT_SIGNAL_FILL: ExpressionSpecification = [
  "match",
  ["get", "enrollment_signal"],
  "strong_growth", "#4ECDC4", // Mint (full)
  "growth",        "#8EDDD7", // Mint 40% tint
  "stable",        "#6EA3BE", // Steel Blue
  "decline",       "#f58d85", // Coral 20% tint
  "strong_decline","#F37167", // Coral (full)
  "rgba(0,0,0,0)",
];

const ELL_SIGNAL_FILL: ExpressionSpecification = [
  "match",
  ["get", "ell_signal"],
  "strong_growth", "#4ECDC4",
  "growth",        "#8EDDD7",
  "stable",        "#6EA3BE",
  "decline",       "#f58d85",
  "strong_decline","#F37167",
  "rgba(0,0,0,0)",
];

const SWD_SIGNAL_FILL: ExpressionSpecification = [
  "match",
  ["get", "swd_signal"],
  "strong_growth", "#4ECDC4",
  "growth",        "#8EDDD7",
  "stable",        "#6EA3BE",
  "decline",       "#f58d85",
  "strong_decline","#F37167",
  "rgba(0,0,0,0)",
];

// Expenditure per pupil signal: quartile-based (well_below → well_above)
// Uses warm-to-cool spectrum: Coral (high spend) → Golden → Steel Blue → Mint (low spend)
const EXPENDITURE_SIGNAL_FILL: ExpressionSpecification = [
  "match",
  ["get", "expenditure_signal"],
  "well_above", "#F37167", // Coral — high spending
  "above",      "#FFCF70", // Golden
  "below",      "#6EA3BE", // Steel Blue
  "well_below",  "#4ECDC4", // Mint — low spending
  "rgba(0,0,0,0)",
];

const EXPENDITURE_LEGEND: SignalLegendItem[] = [
  { label: "Well Above Avg", color: "#F37167" },
  { label: "Above Avg",      color: "#FFCF70" },
  { label: "Below Avg",      color: "#6EA3BE" },
  { label: "Well Below Avg", color: "#4ECDC4" },
];

// Locale signal: distinct colors per category
const LOCALE_SIGNAL_FILL: ExpressionSpecification = [
  "match",
  ["get", "locale_signal"],
  "city",   "#403770", // Plum
  "suburb", "#6EA3BE", // Steel Blue
  "town",   "#FFCF70", // Golden
  "rural",  "#4ECDC4", // Mint
  "rgba(0,0,0,0)",
];

const GROWTH_LEGEND: SignalLegendItem[] = [
  { label: "Strong Growth", color: "#4ECDC4" },
  { label: "Growth",        color: "#8EDDD7" },
  { label: "Stable",        color: "#6EA3BE" },
  { label: "Decline",       color: "#f58d85" },
  { label: "Strong Decline", color: "#F37167" },
];

export const SIGNAL_CONFIGS: Record<SignalId, SignalConfig> = {
  enrollment: {
    id: "enrollment",
    label: "Enrollment Trend",
    tileProperty: "enrollment_signal",
    fillColor: ENROLLMENT_SIGNAL_FILL,
    fillOpacity: 0.55,
    legendItems: GROWTH_LEGEND,
  },
  ell: {
    id: "ell",
    label: "ELL Trend",
    tileProperty: "ell_signal",
    fillColor: ELL_SIGNAL_FILL,
    fillOpacity: 0.55,
    legendItems: GROWTH_LEGEND,
  },
  swd: {
    id: "swd",
    label: "SWD Trend",
    tileProperty: "swd_signal",
    fillColor: SWD_SIGNAL_FILL,
    fillOpacity: 0.55,
    legendItems: GROWTH_LEGEND,
  },
  expenditure: {
    id: "expenditure",
    label: "Per Pupil Spend",
    tileProperty: "expenditure_signal",
    fillColor: EXPENDITURE_SIGNAL_FILL,
    fillOpacity: 0.55,
    legendItems: EXPENDITURE_LEGEND,
  },
};

export const SIGNAL_IDS: SignalId[] = ["enrollment", "ell", "swd", "expenditure"];

// ============================================
// Dynamic palette expression builders
// ============================================

/**
 * Build a MapLibre match expression for a vendor layer using a color palette.
 */
export function buildVendorFillExpression(
  vendorId: VendorId,
  palette: VendorPalette,
): ExpressionSpecification {
  const tileProperty = VENDOR_CONFIGS[vendorId].tileProperty;
  const s = palette.stops;

  if (vendorId === "fullmind") {
    return [
      "match",
      ["get", tileProperty],
      "target", s[0],
      "new_pipeline", s[2],
      "renewal_pipeline", s[4],
      "expansion_pipeline", s[5],
      "lapsed", s[1],
      "new", s[3],
      "multi_year", s[6],
      "rgba(0,0,0,0)",
    ];
  }

  // Competitor vendors: 3 categories
  return [
    "match",
    ["get", tileProperty],
    "churned", s[0],
    "new", s[4],
    "multi_year", s[5],
    "rgba(0,0,0,0)",
  ];
}

/**
 * Build a MapLibre match expression for a signal layer using a color palette.
 */
export function buildSignalFillExpression(
  signalId: SignalId,
  palette: SignalPalette,
): ExpressionSpecification {
  const tileProperty = SIGNAL_CONFIGS[signalId].tileProperty;

  if (signalId === "expenditure") {
    const s = palette.expenditureStops;
    return [
      "match",
      ["get", tileProperty],
      "well_above", s[0],
      "above", s[1],
      "below", s[2],
      "well_below", s[3],
      "rgba(0,0,0,0)",
    ];
  }

  const s = palette.growthStops;
  return [
    "match",
    ["get", tileProperty],
    "strong_growth", s[0],
    "growth", s[1],
    "stable", s[2],
    "decline", s[3],
    "strong_decline", s[4],
    "rgba(0,0,0,0)",
  ];
}


// ============================================
// Locale definitions
// ============================================

export type LocaleId = "city" | "suburb" | "town" | "rural";

export const ALL_LOCALE_IDS: LocaleId[] = ["city", "suburb", "town", "rural"];

export const LOCALE_LAYER_META: Record<LocaleId, { label: string; color: string }> = {
  city:   { label: "City",   color: "#403770" }, // Plum
  suburb: { label: "Suburb", color: "#6EA3BE" }, // Steel Blue
  town:   { label: "Town",   color: "#FFCF70" }, // Golden
  rural:  { label: "Rural",  color: "#4ECDC4" }, // Mint
};

/** Fill color expression for the locale layer (uses locale_signal tile property) */
export const LOCALE_FILL: ExpressionSpecification = LOCALE_SIGNAL_FILL;

// ============================================
// Circle layer for non-district point accounts
// ============================================

export const ACCOUNT_POINT_LAYER_ID = "account-points";

/**
 * Build a MapLibre circle layer spec for non-district point accounts
 * (CMOs, ESAs, etc.). Colors points using the first active vendor's
 * fill-color expression so they match polygon shading.
 */
export function buildAccountPointLayer(
  activeVendors: Set<VendorId>,
): CircleLayerSpecification {
  // Use the first active vendor's fill color, fall back to Plum
  const firstVendor = [...activeVendors][0];
  const colorExpression: ExpressionSpecification | string = firstVendor
    ? VENDOR_CONFIGS[firstVendor].fillColor
    : "#8B7AB8"; // Plum 20% tint fallback

  return {
    id: ACCOUNT_POINT_LAYER_ID,
    type: "circle",
    source: "districts",
    "source-layer": "districts",
    filter: ["all",
      ["has", "account_type"],
      ["!=", ["get", "account_type"], "district"],
    ],
    paint: {
      "circle-radius": [
        "interpolate", ["linear"], ["zoom"],
        4, 4,
        8, 6,
        12, 10,
      ],
      "circle-color": colorExpression as any,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.5,
      "circle-opacity": 0.9,
    },
  };
}

// ============================================
// Fullmind engagement → tile category mapping
// ============================================

/** Maps UI engagement level IDs to raw fullmind_category tile values */
export const FULLMIND_ENGAGEMENT_CATEGORIES: Record<string, string[]> = {
  target:     ["target"],
  pipeline:   ["new_pipeline", "renewal_pipeline", "expansion_pipeline"],
  first_year: ["new"],
  multi_year: ["multi_year"],
  lapsed:     ["lapsed"],
};

/** Convert selected engagement IDs to the raw fullmind_category values for tile filtering */
export function engagementToCategories(engagements: string[]): string[] {
  return engagements.flatMap((e) => FULLMIND_ENGAGEMENT_CATEGORIES[e] ?? []);
}

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
  filterStates: string[],
): ExpressionSpecification | null {
  const conditions: ExpressionSpecification[] = [];

  if (filterStates.length > 0) {
    conditions.push(["in", ["get", "state_abbrev"], ["literal", filterStates]] as ExpressionSpecification);
  }

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
