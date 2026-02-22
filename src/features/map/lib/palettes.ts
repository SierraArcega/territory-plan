import type { VendorId } from "@/features/map/lib/layers";

export interface VendorPalette {
  id: string;
  label: string;
  baseColor: string;
  dotColor: string;
  /** 7 stops ordered lightest to darkest, mapping to:
   * [0] target (90% tint)
   * [1] lapsed (80% tint)
   * [2] new_pipeline (50% tint)
   * [3] new/first_year (40% tint)
   * [4] renewal_pipeline (20% shade)
   * [5] expansion_pipeline / multi_year (full)
   * [6] multi_year (full, duplicate of [5] for Fullmind)
   *
   * For competitors (3 categories): churned=[0], new=[4], multi_year=[5]
   */
  stops: [string, string, string, string, string, string, string];
}

export interface SignalPalette {
  id: string;
  label: string;
  /** 5 stops: strong_growth, growth, stable, decline, strong_decline */
  growthStops: [string, string, string, string, string];
  /** 4 stops: well_above, above, below, well_below */
  expenditureStops: [string, string, string, string];
  /** Primary dot color for signal toggles */
  dotColor: string;
}

// ============================================
// Vendor Palettes
// ============================================

export const VENDOR_PALETTES: VendorPalette[] = [
  {
    id: "plum",
    label: "Plum",
    baseColor: "#403770",
    dotColor: "#403770",
    stops: [
      "#ecebf1",
      "#d9d7e2",
      "#b3afc6",
      "#8c87a9",
      "#665f8d",
      "#403770",
      "#403770",
    ],
  },
  {
    id: "coral",
    label: "Coral",
    baseColor: "#F37167",
    dotColor: "#F37167",
    stops: [
      "#fef1f0",
      "#fde3e1",
      "#f9b5b0",
      "#f69d96",
      "#f58d85",
      "#F37167",
      "#F37167",
    ],
  },
  {
    id: "steel-blue",
    label: "Steel Blue",
    baseColor: "#6EA3BE",
    dotColor: "#6EA3BE",
    stops: [
      "#e8f1f5",
      "#d1e3ec",
      "#c4dae6",
      "#a6c9da",
      "#8bb5cb",
      "#6EA3BE",
      "#6EA3BE",
    ],
  },
  {
    id: "golden",
    label: "Golden",
    baseColor: "#FFCF70",
    dotColor: "#FFCF70",
    stops: [
      "#fffaf1",
      "#fff5e2",
      "#ffe9b8",
      "#ffe1a2",
      "#ffd98d",
      "#FFCF70",
      "#FFCF70",
    ],
  },
  {
    id: "mint",
    label: "Mint",
    baseColor: "#4ECDC4",
    dotColor: "#4ECDC4",
    stops: [
      "#e5f7f6",
      "#ccf0ed",
      "#a6e5e1",
      "#8EDDD7",
      "#6ED5CD",
      "#4ECDC4",
      "#4ECDC4",
    ],
  },
  {
    id: "ocean",
    label: "Ocean",
    baseColor: "#2E6B8A",
    dotColor: "#2E6B8A",
    stops: [
      "#e6eff4",
      "#c0d7e3",
      "#93bad0",
      "#6fa4be",
      "#4e8fad",
      "#2E6B8A",
      "#2E6B8A",
    ],
  },
  {
    id: "forest",
    label: "Forest",
    baseColor: "#2D6A4F",
    dotColor: "#2D6A4F",
    stops: [
      "#e6f0eb",
      "#bfd9cc",
      "#8fbfaa",
      "#6faa8f",
      "#4f9575",
      "#2D6A4F",
      "#2D6A4F",
    ],
  },
  {
    id: "rose",
    label: "Rose",
    baseColor: "#B5485A",
    dotColor: "#B5485A",
    stops: [
      "#f5e8eb",
      "#e6c7cd",
      "#d49da8",
      "#c6848f",
      "#bd6b79",
      "#B5485A",
      "#B5485A",
    ],
  },
  {
    id: "slate",
    label: "Slate",
    baseColor: "#4A5568",
    dotColor: "#4A5568",
    stops: [
      "#edf0f2",
      "#d3d9df",
      "#b0bac4",
      "#96a3b0",
      "#7d8d9c",
      "#4A5568",
      "#4A5568",
    ],
  },
  {
    id: "amber",
    label: "Amber",
    baseColor: "#D97706",
    dotColor: "#D97706",
    stops: [
      "#fef3e2",
      "#fde6c0",
      "#fbd08a",
      "#f9c36d",
      "#f0a933",
      "#D97706",
      "#D97706",
    ],
  },
];

// ============================================
// Signal Palettes
// ============================================

export const SIGNAL_PALETTES: SignalPalette[] = [
  {
    id: "mint-coral",
    label: "Mint / Coral",
    growthStops: ["#4ECDC4", "#8EDDD7", "#6EA3BE", "#f58d85", "#F37167"],
    expenditureStops: ["#F37167", "#FFCF70", "#6EA3BE", "#4ECDC4"],
    dotColor: "#4ECDC4",
  },
  {
    id: "green-red",
    label: "Green / Red",
    growthStops: ["#22C55E", "#6EE7A0", "#94A3B8", "#F87171", "#EF4444"],
    expenditureStops: ["#EF4444", "#F59E0B", "#94A3B8", "#22C55E"],
    dotColor: "#22C55E",
  },
  {
    id: "blue-orange",
    label: "Blue / Orange",
    growthStops: ["#3B82F6", "#7CAFF8", "#94A3B8", "#FDBA74", "#F97316"],
    expenditureStops: ["#F97316", "#FBBF24", "#94A3B8", "#3B82F6"],
    dotColor: "#3B82F6",
  },
  {
    id: "purple-gold",
    label: "Purple / Gold",
    growthStops: ["#8B5CF6", "#B197F8", "#94A3B8", "#FCD34D", "#EAB308"],
    expenditureStops: ["#EAB308", "#F97316", "#94A3B8", "#8B5CF6"],
    dotColor: "#8B5CF6",
  },
];

// ============================================
// Defaults
// ============================================

export const DEFAULT_VENDOR_PALETTE: Record<VendorId, string> = {
  fullmind: "plum",
  proximity: "coral",
  elevate: "steel-blue",
  tbt: "golden",
};

export const DEFAULT_SIGNAL_PALETTE = "mint-coral";

// ============================================
// Lookup helpers
// ============================================

const vendorPaletteMap = new Map(
  VENDOR_PALETTES.map((p) => [p.id, p]),
);
const signalPaletteMap = new Map(
  SIGNAL_PALETTES.map((p) => [p.id, p]),
);

export function getVendorPalette(id: string): VendorPalette {
  return vendorPaletteMap.get(id) ?? vendorPaletteMap.get("plum")!;
}

export function getSignalPalette(id: string): SignalPalette {
  return signalPaletteMap.get(id) ?? signalPaletteMap.get("mint-coral")!;
}
