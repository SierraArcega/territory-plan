import type { ExpressionSpecification } from "maplibre-gl";

// ============================================
// Vendor base colors (from plan spec)
// ============================================
export const VENDOR_COLORS: Record<string, string> = {
  Fullmind: "#403770",
  "Proximity Learning": "#F37167",
  "Elevate K12": "#6EA3BE",
  "Tutored By Teachers": "#FFCF70",
};

// ============================================
// Customer category colors
// ============================================
export const CUSTOMER_COLORS: Record<string, string> = {
  multi_year: "#403770",
  new: "#22C55E",
  lapsed: "#F37167",
  pipeline: "#F59E0B",
  target: "#6EA3BE",
};

export const CUSTOMER_LABELS: Record<string, string> = {
  multi_year: "Multi-year Customer",
  new: "New This Year",
  lapsed: "Lapsed Customer",
  pipeline: "In Pipeline",
  target: "Target",
};

// ============================================
// State colors — a warm palette for 50 states
// ============================================
const STATE_PALETTE = [
  "#403770", "#F37167", "#6EA3BE", "#FFCF70", "#22C55E",
  "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#06B6D4",
  "#A855F7", "#EF4444", "#10B981", "#F59E0B", "#3B82F6",
  "#D946EF", "#84CC16", "#0EA5E9", "#FB923C", "#6366F1",
];

export function getStateColor(stateCode: string): string {
  // Simple hash to pick a consistent color per state
  let hash = 0;
  for (let i = 0; i < stateCode.length; i++) {
    hash = stateCode.charCodeAt(i) + ((hash << 5) - hash);
  }
  return STATE_PALETTE[Math.abs(hash) % STATE_PALETTE.length];
}

// ============================================
// Paint expressions per layer type
// ============================================

export type LayerType =
  | "customers"
  | "state"
  | "owner"
  | "territory_plan"
  | "competitors"
  | "enrollment"
  | "revenue";

export interface LayerConfig {
  fillColor: ExpressionSpecification | string;
  fillOpacity: number;
  /** Whether to show non-customer districts */
  showAllDistricts: boolean;
  /** Legend entries */
  legend: Array<{ color: string; label: string }>;
}

export function getLayerConfig(layer: LayerType): LayerConfig {
  switch (layer) {
    case "customers":
      return {
        fillColor: [
          "match",
          ["get", "customer_category"],
          "multi_year", "#403770",
          "new", "#22C55E",
          "lapsed", "#F37167",
          "pipeline", "#F59E0B",
          "target", "#6EA3BE",
          "#E5E7EB",
        ] as ExpressionSpecification,
        fillOpacity: 0.65,
        showAllDistricts: false,
        legend: [
          { color: "#403770", label: "Multi-year" },
          { color: "#22C55E", label: "New" },
          { color: "#F37167", label: "Lapsed" },
          { color: "#F59E0B", label: "Pipeline" },
          { color: "#6EA3BE", label: "Target" },
          { color: "#E5E7EB", label: "No data" },
        ],
      };

    case "competitors":
      return {
        fillColor: [
          "match",
          ["get", "dominant_vendor"],
          "Fullmind", "#403770",
          "Proximity Learning", "#F37167",
          "Elevate K12", "#6EA3BE",
          "Tutored By Teachers", "#FFCF70",
          "#E5E7EB",
        ] as ExpressionSpecification,
        fillOpacity: 0.7,
        showAllDistricts: false,
        legend: [
          { color: "#403770", label: "Fullmind" },
          { color: "#F37167", label: "Proximity Learning" },
          { color: "#6EA3BE", label: "Elevate K12" },
          { color: "#FFCF70", label: "Tutored By Teachers" },
          { color: "#E5E7EB", label: "Other / None" },
        ],
      };

    case "enrollment":
      return {
        fillColor: [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "enrollment"], 0],
          0, "#ecebf1",
          1000, "#d9d7e2",
          5000, "#b3afc6",
          10000, "#8c87a9",
          25000, "#665f8d",
          50000, "#403770",
        ] as ExpressionSpecification,
        fillOpacity: 0.7,
        showAllDistricts: true,
        legend: [
          { color: "#ecebf1", label: "< 1K" },
          { color: "#d9d7e2", label: "1K–5K" },
          { color: "#b3afc6", label: "5K–10K" },
          { color: "#8c87a9", label: "10K–25K" },
          { color: "#665f8d", label: "25K–50K" },
          { color: "#403770", label: "50K+" },
        ],
      };

    case "revenue":
      return {
        fillColor: [
          "interpolate",
          ["linear"],
          ["coalesce", ["get", "net_invoicing"], 0],
          0, "#ecebf1",
          10000, "#d9d7e2",
          50000, "#b3afc6",
          100000, "#8c87a9",
          250000, "#665f8d",
          500000, "#403770",
        ] as ExpressionSpecification,
        fillOpacity: 0.7,
        showAllDistricts: false,
        legend: [
          { color: "#ecebf1", label: "$0" },
          { color: "#d9d7e2", label: "$10K" },
          { color: "#b3afc6", label: "$50K" },
          { color: "#8c87a9", label: "$100K" },
          { color: "#665f8d", label: "$250K" },
          { color: "#403770", label: "$500K+" },
        ],
      };

    case "state":
      return {
        fillColor: [
          "match",
          ["get", "state_abbrev"],
          "CA", "#403770", "TX", "#F37167", "NY", "#6EA3BE", "FL", "#FFCF70",
          "IL", "#22C55E", "PA", "#8B5CF6", "OH", "#EC4899", "GA", "#14B8A6",
          "NC", "#F97316", "MI", "#06B6D4", "NJ", "#A855F7", "VA", "#EF4444",
          "WA", "#10B981", "AZ", "#F59E0B", "MA", "#3B82F6", "TN", "#D946EF",
          "IN", "#84CC16", "MO", "#0EA5E9", "MD", "#FB923C", "WI", "#6366F1",
          "#9CA3AF",
        ] as ExpressionSpecification,
        fillOpacity: 0.6,
        showAllDistricts: true,
        legend: [
          { color: "#403770", label: "CA" },
          { color: "#F37167", label: "TX" },
          { color: "#6EA3BE", label: "NY" },
          { color: "#FFCF70", label: "FL" },
          { color: "#9CA3AF", label: "Other states" },
        ],
      };

    case "owner":
      return {
        fillColor: [
          "case",
          ["has", "sales_executive"],
          [
            "match",
            ["get", "sales_executive"],
            "Unassigned", "#E5E7EB",
            // Hash-based color — fallback to a steel blue
            "#6EA3BE",
          ],
          "#E5E7EB",
        ] as unknown as ExpressionSpecification,
        fillOpacity: 0.6,
        showAllDistricts: true,
        legend: [
          { color: "#6EA3BE", label: "Assigned" },
          { color: "#E5E7EB", label: "Unassigned" },
        ],
      };

    case "territory_plan":
      return {
        fillColor: "#9CA3AF" as string,
        fillOpacity: 0.5,
        showAllDistricts: false,
        legend: [
          { color: "#9CA3AF", label: "No plan assigned" },
        ],
      };

    default:
      return getLayerConfig("customers");
  }
}
