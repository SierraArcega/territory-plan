import type { VendorId } from "@/features/map/lib/layers";
import {
  DEFAULT_VENDOR_PALETTE,
  DEFAULT_SIGNAL_PALETTE,
  DEFAULT_CATEGORY_COLORS,
  DEFAULT_CATEGORY_OPACITIES,
} from "@/features/map/lib/palettes";
import { getDefaultFiscalYearKey } from "@/features/shared/lib/fiscal-year";
// Type-only import: erased at runtime, so there is NO runtime cycle even though
// store.ts imports the value constants below from this module.
import type { MapViewState } from "@/features/map/lib/store";

/**
 * Canonical defaults shared by the live map store (useMapV2Store initial state)
 * and any server-side code that needs to construct a baseline map view (the
 * copilot `map_view.create` action). This module is the single source of truth
 * for these values; store.ts imports them so the two can't drift.
 *
 * Keep this module server-safe — import only pure data modules (no `window`,
 * `localStorage`, or `maplibre-gl` value imports), since it is pulled into API
 * routes via the copilot action registry.
 */

/** All metric IDs shown in the summary bar, in display order. */
export const ALL_METRIC_IDS = [
  "districts",
  "enrollment",
  "pipeline",
  "bookings",
  "invoicing",
  "scheduledRevenue",
  "completedRevenue",
  "deferredRevenue",
  "totalRevenue",
  "completedTake",
  "scheduledTake",
  "totalTake",
] as const;

export type MetricId = (typeof ALL_METRIC_IDS)[number];

/** Fullmind engagement categories shown by default (everything except `target`). */
export const DEFAULT_FULLMIND_ENGAGEMENT: string[] = [
  "new_business_pipeline",
  "winback_pipeline",
  "renewal_pipeline",
  "expansion_pipeline",
  "first_year",
  "multi_year_growing",
  "multi_year_flat",
  "multi_year_shrinking",
  "lapsed",
];

/** Default per-vendor tile opacity. */
export const DEFAULT_VENDOR_OPACITIES: Record<VendorId, number> = {
  fullmind: 0.75,
  proximity: 0.75,
  elevate: 0.8,
  tbt: 0.75,
  educere: 0.75,
};

/**
 * A clean baseline `MapViewState` — the app defaults with no filters applied.
 * Server-side view creation spreads model-described fields over this so a saved
 * view uses standard styling and only the filters the rep asked for.
 */
export const DEFAULT_MAP_VIEW_STATE: MapViewState = {
  activeVendors: ["fullmind"],
  filterOwner: null,
  filterStates: [],
  filterAccountTypes: [],
  fullmindEngagement: [...DEFAULT_FULLMIND_ENGAGEMENT],
  competitorEngagement: {},
  vendorPalettes: { ...DEFAULT_VENDOR_PALETTE },
  signalPalette: DEFAULT_SIGNAL_PALETTE,
  categoryColors: { ...DEFAULT_CATEGORY_COLORS },
  categoryOpacities: { ...DEFAULT_CATEGORY_OPACITIES },
  vendorOpacities: { ...DEFAULT_VENDOR_OPACITIES },
  activeSignal: null,
  visibleLocales: [],
  visibleSchoolTypes: [],
  selectedFiscalYear: getDefaultFiscalYearKey(),
  visibleMetrics: [...ALL_METRIC_IDS],
};
