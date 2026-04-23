"use client";

import React, { useEffect, useRef, useCallback, useState, useMemo } from "react";
import maplibregl, { setWorkerCount } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Use more workers for parallel tile decoding during fast panning
setWorkerCount(4);
import { useMapV2Store } from "@/features/map/lib/store";
import { VENDOR_CONFIGS, VENDOR_IDS, SIGNAL_CONFIGS, LOCALE_FILL, ALL_LOCALE_IDS, buildFilterExpression, ACCOUNT_POINT_LAYER_ID, buildAccountPointLayer, engagementToCategories, buildVendorFillExpression, buildSignalFillExpression, buildVendorFillExpressionFromCategories, buildSignalFillExpressionFromCategories, buildCategoryOpacityExpression, buildTransitionFillExpression, NOT_ROLLUP_FILTER, DISTRICT_ROLLUP_OUTLINE_LAYER } from "@/features/map/lib/layers";
import type { SignalId } from "@/features/map/lib/layers";
import { getVendorPalette, getSignalPalette } from "@/features/map/lib/palettes";
import { useIsTouchDevice } from "@/features/map/hooks/use-is-touch-device";
import { useProfile } from "@/lib/api";
import { mapV2Ref, mapV2Refs, type MapRefKey } from "@/features/map/lib/ref";
import { classifyTransition } from "@/features/map/lib/comparison";
import { useSchoolGeoJSON, useMapContacts, useMapVacancies, useMapActivities, useMapPlans } from "@/features/map/lib/queries";
import { useCrossFilter } from "@/features/map/lib/useCrossFilter";
import {
  CONTACTS_SOURCE, VACANCIES_SOURCE, ACTIVITIES_SOURCE, PLANS_SOURCE,
  CONTACTS_POINT_LAYER, VACANCIES_POINT_LAYER, ACTIVITIES_POINT_LAYER,
  CONTACTS_CLUSTER_LAYER, VACANCIES_CLUSTER_LAYER, ACTIVITIES_CLUSTER_LAYER,
  PLANS_FILL_LAYER, PLANS_OUTLINE_LAYER,
  ALL_OVERLAY_POINT_LAYERS, ALL_OVERLAY_CLUSTER_LAYERS,
  createClusteredSource, createGeoJSONSource,
  getContactLayers, getVacancyLayers, getActivityLayers, getPlanLayers,
  layerIdToOverlayType, overlayTypeToPanel,
} from "@/features/map/lib/pin-layers";
import type { RightPanelContent } from "@/features/map/lib/store";
import MapV2Tooltip from "./MapV2Tooltip";
import { pickDistrictFeature } from "./pickDistrictFeature";

export interface MapV2ContainerProps {
  /** Override the fiscal year used for tile requests (for side-by-side panes) */
  fyOverride?: string;
  /** Additional query params appended to the tile URL (e.g. "&fy2=fy27") */
  tileUrlSuffix?: string;
  /** Which ref slot this instance occupies */
  refKey?: MapRefKey;
  /** Maps logical tile property names to actual names (for compare mode tiles) */
  tooltipPropertyMap?: Record<string, string>;
}

// Throttle interval for hover handlers
const HOVER_THROTTLE_MS = 50;

const SCHOOL_MIN_ZOOM = 9;

// US bounds
const US_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-125, 24],
  [-66, 50],
];

// State bounding boxes
export const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
  AL: [[-88.5, 30.2], [-84.9, 35.0]],
  AK: [[-179.2, 51.2], [-129.9, 71.4]],
  AZ: [[-114.8, 31.3], [-109.0, 37.0]],
  AR: [[-94.6, 33.0], [-89.6, 36.5]],
  CA: [[-124.4, 32.5], [-114.1, 42.0]],
  CO: [[-109.1, 37.0], [-102.0, 41.0]],
  CT: [[-73.7, 41.0], [-71.8, 42.1]],
  DE: [[-75.8, 38.5], [-75.0, 39.8]],
  DC: [[-77.1, 38.8], [-76.9, 39.0]],
  FL: [[-87.6, 24.5], [-80.0, 31.0]],
  GA: [[-85.6, 30.4], [-80.8, 35.0]],
  HI: [[-160.2, 18.9], [-154.8, 22.2]],
  ID: [[-117.2, 42.0], [-111.0, 49.0]],
  IL: [[-91.5, 37.0], [-87.5, 42.5]],
  IN: [[-88.1, 37.8], [-84.8, 41.8]],
  IA: [[-96.6, 40.4], [-90.1, 43.5]],
  KS: [[-102.1, 37.0], [-94.6, 40.0]],
  KY: [[-89.6, 36.5], [-81.9, 39.1]],
  LA: [[-94.0, 29.0], [-89.0, 33.0]],
  ME: [[-71.1, 43.1], [-66.9, 47.5]],
  MD: [[-79.5, 37.9], [-75.0, 39.7]],
  MA: [[-73.5, 41.2], [-69.9, 42.9]],
  MI: [[-90.4, 41.7], [-82.4, 48.2]],
  MN: [[-97.2, 43.5], [-89.5, 49.4]],
  MS: [[-91.7, 30.2], [-88.1, 35.0]],
  MO: [[-95.8, 36.0], [-89.1, 40.6]],
  MT: [[-116.1, 45.0], [-104.0, 49.0]],
  NE: [[-104.1, 40.0], [-95.3, 43.0]],
  NV: [[-120.0, 35.0], [-114.0, 42.0]],
  NH: [[-72.6, 42.7], [-70.7, 45.3]],
  NJ: [[-75.6, 38.9], [-73.9, 41.4]],
  NM: [[-109.1, 31.3], [-103.0, 37.0]],
  NY: [[-79.8, 40.5], [-71.9, 45.0]],
  NC: [[-84.3, 33.8], [-75.5, 36.6]],
  ND: [[-104.1, 45.9], [-96.6, 49.0]],
  OH: [[-84.8, 38.4], [-80.5, 42.0]],
  OK: [[-103.0, 33.6], [-94.4, 37.0]],
  OR: [[-124.6, 42.0], [-116.5, 46.3]],
  PA: [[-80.5, 39.7], [-74.7, 42.3]],
  RI: [[-71.9, 41.1], [-71.1, 42.0]],
  SC: [[-83.4, 32.0], [-78.5, 35.2]],
  SD: [[-104.1, 42.5], [-96.4, 45.9]],
  TN: [[-90.3, 35.0], [-81.6, 36.7]],
  TX: [[-106.6, 25.8], [-93.5, 36.5]],
  UT: [[-114.1, 37.0], [-109.0, 42.0]],
  VT: [[-73.4, 42.7], [-71.5, 45.0]],
  VA: [[-83.7, 36.5], [-75.2, 39.5]],
  WA: [[-124.8, 45.5], [-116.9, 49.0]],
  WV: [[-82.6, 37.2], [-77.7, 40.6]],
  WI: [[-92.9, 42.5], [-86.8, 47.1]],
  WY: [[-111.1, 41.0], [-104.1, 45.0]],
  PR: [[-67.3, 17.9], [-65.2, 18.5]],
  VI: [[-65.1, 17.7], [-64.6, 18.4]],
  GU: [[144.6, 13.2], [145.0, 13.7]],
  AS: [[-171.1, -14.5], [-168.1, -11.0]],
  MP: [[144.9, 14.1], [146.1, 20.6]],
};

// State name to abbreviation
const STATE_NAME_TO_ABBREV: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI",
  Wyoming: "WY", "Puerto Rico": "PR", "Virgin Islands": "VI", Guam: "GU",
  "American Samoa": "AS", "Northern Mariana Islands": "MP",
};

// Inverted: abbreviation → state name (for highlighting filtered states)
const ABBREV_TO_STATE_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAME_TO_ABBREV).map(([name, abbrev]) => [abbrev, name])
);

// Click ripples extracted into their own component so ripple animations
// don't trigger a re-render of the entire 1000+ line map container.
const ClickRipples = React.memo(function ClickRipples() {
  const clickRipples = useMapV2Store((s) => s.clickRipples);
  const removeClickRipple = useMapV2Store((s) => s.removeClickRipple);

  return (
    <>
      {clickRipples.map((ripple) => (
        <div
          key={ripple.id}
          className={`click-ripple click-ripple-${ripple.color}`}
          style={{ left: ripple.x, top: ripple.y }}
          onAnimationEnd={() => removeClickRipple(ripple.id)}
        />
      ))}
    </>
  );
});

export default function MapV2Container({
  fyOverride,
  tileUrlSuffix,
  refKey = "primary",
  tooltipPropertyMap,
}: MapV2ContainerProps = {}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isTouchDevice = useIsTouchDevice();
  const { data: profile } = useProfile();

  // Viewport bounds for school query (updated on moveend)
  const [schoolBounds, setSchoolBounds] = useState<[number, number, number, number] | null>(null);

  // Refs for hover optimization
  const lastHoveredLeaidRef = useRef<string | null>(null);
  const lastHoverTimeRef = useRef(0);
  const tooltipElRef = useRef<HTMLDivElement>(null);
  const searchResultSetRef = useRef<Set<string>>(new Set());

  // === Render-triggering state (granular selectors) ===
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const activeVendors = useMapV2Store((s) => s.activeVendors);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const visibleSchoolTypes = useMapV2Store((s) => s.visibleSchoolTypes);
  const activeSignal = useMapV2Store((s) => s.activeSignal);
  const visibleLocales = useMapV2Store((s) => s.visibleLocales);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const fullmindEngagement = useMapV2Store((s) => s.fullmindEngagement);
  const competitorEngagement = useMapV2Store((s) => s.competitorEngagement);
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const vendorPalettes = useMapV2Store((s) => s.vendorPalettes);
  const vendorOpacities = useMapV2Store((s) => s.vendorOpacities);
  const signalPalette = useMapV2Store((s) => s.signalPalette);
  const categoryColors = useMapV2Store((s) => s.categoryColors);
  const categoryOpacities = useMapV2Store((s) => s.categoryOpacities);
  const pendingFitBounds = useMapV2Store((s) => s.pendingFitBounds);
  const clearPendingFitBounds = useMapV2Store((s) => s.clearPendingFitBounds);
  const focusLeaids = useMapV2Store((s) => s.focusLeaids);

  // Overlay layer state
  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const dateRange = useMapV2Store((s) => s.dateRange);
  const mapBounds = useMapV2Store((s) => s.mapBounds);

  // Color By dimension — controls which choropleth visualization is active
  const colorBy = useMapV2Store((s) => s.colorBy);

  // School GeoJSON — TanStack Query with quantized bounds for cache reuse
  const schoolsEnabled = visibleSchoolTypes.size > 0 && mapReady;
  const { data: schoolGeoJSON } = useSchoolGeoJSON(schoolBounds, schoolsEnabled);

  // Extract geographic state filters from searchFilters for overlay layer filtering
  const searchFiltersForGeo = useMapV2Store((s) => s.searchFilters);
  const geoStates = useMemo(() => {
    const stateFilter = searchFiltersForGeo.find((f) => f.column === "state");
    if (!stateFilter) return undefined;
    if (stateFilter.op === "in" && Array.isArray(stateFilter.value)) {
      return stateFilter.value as string[];
    }
    if (stateFilter.op === "eq" && typeof stateFilter.value === "string") {
      return [stateFilter.value];
    }
    return undefined;
  }, [searchFiltersForGeo]);

  // Overlay GeoJSON — TanStack Query, conditionally fetched when layer is active
  const contactsEnabled = activeLayers.has("contacts") && mapReady;
  const { data: contactsGeoJSON, isLoading: contactsLoading } = useMapContacts(
    mapBounds, layerFilters.contacts, contactsEnabled, geoStates,
  );

  const vacanciesEnabled = activeLayers.has("vacancies") && mapReady;
  const { data: vacanciesGeoJSON, isLoading: vacanciesLoading } = useMapVacancies(
    mapBounds, layerFilters.vacancies, dateRange.vacancies, vacanciesEnabled, geoStates,
  );

  const activitiesEnabled = activeLayers.has("activities") && mapReady;
  const { data: activitiesGeoJSON, isLoading: activitiesLoading } = useMapActivities(
    mapBounds, layerFilters.activities, dateRange.activities, activitiesEnabled, geoStates,
  );

  const plansEnabled = activeLayers.has("plans") && mapReady;
  const { data: plansGeoJSON, isLoading: plansLoading } = useMapPlans(
    layerFilters.plans, plansEnabled,
  );

  // Push school data to map source whenever it changes
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource("schools") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (schoolGeoJSON) {
      source.setData(schoolGeoJSON);
    } else if (!schoolsEnabled) {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [schoolGeoJSON, schoolsEnabled, mapReady]);

  // Cross-filter: constrains overlay rendering by plan focus, plan filters, and search results
  const { filterOverlayGeoJSON } = useCrossFilter({
    plansGeoJSON,
    contactsGeoJSON,
    vacanciesGeoJSON,
    activitiesGeoJSON,
  });

  // Push overlay contacts data to map source
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource(CONTACTS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const filtered = filterOverlayGeoJSON(contactsGeoJSON);
    if (filtered && contactsEnabled) {
      source.setData(filtered);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [contactsGeoJSON, contactsEnabled, mapReady, filterOverlayGeoJSON]);

  // Push overlay vacancies data to map source
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource(VACANCIES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const filtered = filterOverlayGeoJSON(vacanciesGeoJSON);
    if (filtered && vacanciesEnabled) {
      source.setData(filtered);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [vacanciesGeoJSON, vacanciesEnabled, mapReady, filterOverlayGeoJSON]);

  // Push overlay activities data to map source
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource(ACTIVITIES_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    const filtered = filterOverlayGeoJSON(activitiesGeoJSON);
    if (filtered && activitiesEnabled) {
      source.setData(filtered);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [activitiesGeoJSON, activitiesEnabled, mapReady, filterOverlayGeoJSON]);

  // Push overlay plans data to map source
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource(PLANS_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!source) return;
    if (plansGeoJSON && plansEnabled) {
      source.setData(plansGeoJSON);
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [plansGeoJSON, plansEnabled, mapReady]);

  // Toggle overlay layer visibility based on activeLayers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const layerGroups: Record<string, string[]> = {
      contacts: [CONTACTS_CLUSTER_LAYER, "overlay-contacts-cluster-count", CONTACTS_POINT_LAYER],
      vacancies: [VACANCIES_CLUSTER_LAYER, "overlay-vacancies-cluster-count", VACANCIES_POINT_LAYER],
      activities: [ACTIVITIES_CLUSTER_LAYER, "overlay-activities-cluster-count", ACTIVITIES_POINT_LAYER],
      plans: [PLANS_FILL_LAYER, PLANS_OUTLINE_LAYER],
    };

    for (const [layerType, layerIds] of Object.entries(layerGroups)) {
      const isActive = activeLayers.has(layerType as "contacts" | "vacancies" | "activities" | "plans");
      for (const layerId of layerIds) {
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, "visibility", isActive ? "visible" : "none");
        }
      }
    }
  }, [activeLayers, mapReady]);

  // Color By switching — toggle between vendor/signal/locale fill layers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const isSignalDimension = (dim: string): dim is SignalId =>
      dim === "enrollment" || dim === "ell" || dim === "swd" || dim === "expenditure";

    if (colorBy === "engagement") {
      // Show active vendor fill layers (existing default behavior)
      for (const vendorId of VENDOR_IDS) {
        const layerId = `district-${vendorId}-fill`;
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(
            layerId,
            "visibility",
            activeVendors.has(vendorId) ? "visible" : "none",
          );
        }
      }
      // Hide signal and locale layers
      if (map.current.getLayer("district-signal-fill")) {
        map.current.setLayoutProperty("district-signal-fill", "visibility", "none");
      }
      if (map.current.getLayer("district-locale-fill")) {
        map.current.setLayoutProperty("district-locale-fill", "visibility", "none");
      }
    } else if (isSignalDimension(colorBy)) {
      // Hide all vendor fill layers
      for (const vendorId of VENDOR_IDS) {
        const layerId = `district-${vendorId}-fill`;
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, "visibility", "none");
        }
      }
      // Hide locale layer
      if (map.current.getLayer("district-locale-fill")) {
        map.current.setLayoutProperty("district-locale-fill", "visibility", "none");
      }
      // Show signal fill layer with the appropriate expression
      if (map.current.getLayer("district-signal-fill")) {
        map.current.setLayoutProperty("district-signal-fill", "visibility", "visible");
        map.current.setPaintProperty(
          "district-signal-fill",
          "fill-color",
          buildSignalFillExpressionFromCategories(colorBy, categoryColors) as any,
        );
        map.current.setPaintProperty(
          "district-signal-fill",
          "fill-opacity",
          buildCategoryOpacityExpression(colorBy, categoryOpacities) as any,
        );
        // Update filter to match the signal's tile property
        const config = SIGNAL_CONFIGS[colorBy];
        map.current.setFilter("district-signal-fill", [
          "all",
          ["has", config.tileProperty],
          NOT_ROLLUP_FILTER,
        ]);
      }
    } else if (colorBy === "locale") {
      // Hide all vendor fill layers
      for (const vendorId of VENDOR_IDS) {
        const layerId = `district-${vendorId}-fill`;
        if (map.current.getLayer(layerId)) {
          map.current.setLayoutProperty(layerId, "visibility", "none");
        }
      }
      // Hide signal layer
      if (map.current.getLayer("district-signal-fill")) {
        map.current.setLayoutProperty("district-signal-fill", "visibility", "none");
      }
      // Show locale fill layer
      if (map.current.getLayer("district-locale-fill")) {
        map.current.setLayoutProperty("district-locale-fill", "visibility", "visible");
      }
    }
  }, [colorBy, activeVendors, categoryColors, categoryOpacities, mapReady]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#F8F7F4",
            },
          },
        ],
      },
      bounds: US_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      minZoom: 2,
      maxZoom: 14,
    });

    mapV2Refs[refKey] = map.current;

    // Only add nav control to the primary map (or when not in side-by-side)
    if (refKey === "primary") {
      map.current.addControl(new maplibregl.NavigationControl(), "bottom-right");
    }

    map.current.on("load", () => {
      if (!map.current) return;

      // Add state boundaries source
      map.current.addSource("states", {
        type: "geojson",
        data: "/us-states.json",
      });

      // Add district tiles source (cache-bust via version param)
      {
        const initialFy = fyOverride ?? useMapV2Store.getState().selectedFiscalYear;
        const suffix = tileUrlSuffix ?? "";
        map.current.addSource("districts", {
          type: "vector",
          tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?v=8&fy=${initialFy}${suffix}`],
          minzoom: 2,
          maxzoom: 12,
        });
      }

      // === LAYERS ===

      // State fill (subtle, for interactivity)
      map.current.addLayer({
        id: "state-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "transparent",
          "fill-opacity": 0.1,
        },
      });

      // State outlines
      map.current.addLayer({
        id: "state-outline",
        type: "line",
        source: "states",
        paint: {
          "line-color": "#403770",
          "line-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 6, 2, 10, 1],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.8, 8, 0.5, 12, 0.2],
        },
      });

      // State hover highlight
      map.current.addLayer({
        id: "state-hover",
        type: "line",
        source: "states",
        filter: ["==", ["get", "name"], ""],
        paint: {
          "line-color": "#F37167",
          "line-width": 3,
        },
      });

      // State filter fill (subtle highlight for selected states)
      map.current.addLayer({
        id: "state-filter-fill",
        type: "fill",
        source: "states",
        filter: ["==", ["get", "name"], ""],
        paint: {
          "fill-color": "#403770",
          "fill-opacity": 0.06,
        },
      });

      // State filter outline (prominent border for selected states)
      map.current.addLayer({
        id: "state-filter-outline",
        type: "line",
        source: "states",
        filter: ["==", ["get", "name"], ""],
        paint: {
          "line-color": "#403770",
          "line-width": 2.5,
          "line-opacity": 0.7,
        },
      });

      // Base fill for all districts (light gray background).
      // Exclude rollup districts (e.g., NYC DOE) — they cover the same area
      // as their children and would absorb clicks meant for the child.
      map.current.addLayer({
        id: "district-base-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: NOT_ROLLUP_FILTER as any,
        paint: {
          "fill-color": "#E5E7EB",
          "fill-opacity": ["interpolate", ["linear"], ["zoom"], 2, 0.15, 4, 0.3, 5, 0.4],
        },
      });

      // Base boundary for all districts (excludes rollups; rollups get their
      // own dashed outline via DISTRICT_ROLLUP_OUTLINE_LAYER below)
      map.current.addLayer({
        id: "district-base-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        minzoom: 4.5,
        filter: NOT_ROLLUP_FILTER as any,
        paint: {
          "line-color": "#374151",
          "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 0.1, 5, 0.2, 7, 0.6, 10, 1],
          "line-opacity": ["interpolate", ["linear"], ["zoom"], 4.5, 0.15, 5, 0.4],
        },
      });

      // Dashed outline for rollup districts — visible context without
      // absorbing clicks (no fill, so MapLibre hit-tests pass through).
      map.current.addLayer(DISTRICT_ROLLUP_OUTLINE_LAYER as any);

      // Signal fill layer (renders below vendor layers) — rollups excluded
      map.current.addLayer({
        id: "district-signal-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: NOT_ROLLUP_FILTER as any,
        paint: {
          "fill-color": "rgba(0,0,0,0)",
          "fill-opacity": 0,
        },
        layout: {
          visibility: "none",
        },
      });

      // Locale fill layer (renders below vendor layers, above signal) —
      // rollups excluded
      map.current.addLayer({
        id: "district-locale-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["all", ["has", "locale_signal"], NOT_ROLLUP_FILTER] as any,
        paint: {
          "fill-color": LOCALE_FILL as any,
          "fill-opacity": 0.55,
        },
        layout: {
          visibility: "none",
        },
      });

      // Per-vendor fill layers (stacked, semi-transparent)
      const isChangesMode = !!tileUrlSuffix?.includes("fy2=");
      for (const vendorId of VENDOR_IDS) {
        const config = VENDOR_CONFIGS[vendorId];
        const fillColor = isChangesMode
          ? buildTransitionFillExpression(vendorId) as any
          : buildVendorFillExpressionFromCategories(vendorId, useMapV2Store.getState().categoryColors) as any;
        // In changes mode, use the _a property to detect presence (it replaces the base property)
        const filterProp = isChangesMode ? `${config.tileProperty}_a` : config.tileProperty;
        const vendorHasFilter = isChangesMode
          ? ["any", ["has", `${config.tileProperty}_a`], ["has", `${config.tileProperty}_b`]]
          : ["has", filterProp];
        // Exclude rollups — they shouldn't receive any vendor fill
        const layerFilter = ["all", vendorHasFilter, NOT_ROLLUP_FILTER] as any;
        map.current.addLayer({
          id: `district-${vendorId}-fill`,
          type: "fill",
          source: "districts",
          "source-layer": "districts",
          filter: layerFilter,
          paint: {
            "fill-color": fillColor,
            "fill-opacity": isChangesMode ? 0.75 : buildCategoryOpacityExpression(vendorId, useMapV2Store.getState().categoryOpacities) as any,
            "fill-opacity-transition": { duration: 150 },
          },
          layout: {
            visibility: vendorId === "fullmind" ? "visible" : "none",
          },
        });
      }

      // Circle layer for non-district point accounts (CMOs, ESAs, etc.)
      {
        const pointLayer = buildAccountPointLayer(useMapV2Store.getState().activeVendors);
        map.current.addLayer(pointLayer as any);
      }

      // Hover highlight fill
      map.current.addLayer({
        id: "district-hover-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["==", ["get", "leaid"], ""],
        paint: {
          "fill-color": "#F37167",
          "fill-opacity": 0.35,
          "fill-opacity-transition": { duration: 100 },
        },
      });

      // Hover highlight outline
      map.current.addLayer({
        id: "district-hover",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["==", ["get", "leaid"], ""],
        paint: {
          "line-color": "#F37167",
          "line-width": 2.5,
        },
      });

      // Selected district fill
      map.current.addLayer({
        id: "district-selected-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["==", ["get", "leaid"], ""],
        paint: {
          "fill-color": "#403770",
          "fill-opacity": 0.25,
        },
      });

      // Selected district outline
      map.current.addLayer({
        id: "district-selected",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["==", ["get", "leaid"], ""],
        paint: {
          "line-color": "#403770",
          "line-width": 3,
        },
      });

      // Multi-selected districts fill
      map.current.addLayer({
        id: "district-multiselect-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "fill-color": "#403770",
          "fill-opacity": 0.18,
        },
      });

      // Multi-selected districts outline
      map.current.addLayer({
        id: "district-multiselect-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "line-color": "#403770",
          "line-width": 2,
          "line-dasharray": [2, 1],
        },
      });

      // Focus Map — highlighted plan districts (fill + outline)
      map.current.addLayer({
        id: "district-focus-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "fill-color": "#403770",
          "fill-opacity": 0.25,
        },
      });

      map.current.addLayer({
        id: "district-focus-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "line-color": "#403770",
          "line-width": 2.5,
        },
      });

      // Search filter dim — heavy overlay on NON-matching districts to wash them out
      map.current.addLayer({
        id: "district-search-dim",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["!", ["in", ["get", "leaid"], ["literal", [""]]]],
        paint: {
          "fill-color": "#F8F7F4",
          "fill-opacity": 0,  // starts invisible, activated by search
        },
      });

      // Search filter match — coral fill tint on matching districts
      map.current.addLayer({
        id: "district-search-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "fill-color": "#F37167",
          "fill-opacity": 0,  // starts invisible
        },
      });

      // Search filter match — bold coral outline on matching districts
      map.current.addLayer({
        id: "district-search-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["in", ["get", "leaid"], ["literal", [""]]],
        paint: {
          "line-color": "#F37167",
          "line-width": 2.5,
          "line-opacity": 0,  // starts invisible
        },
      });

      // Search result centroid dots — always visible at any zoom
      map.current.addSource("search-centroids", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      map.current.addLayer({
        id: "search-centroid-dots",
        type: "circle",
        source: "search-centroids",
        paint: {
          "circle-color": "#F37167",
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 6, 5, 8, 6, 10, 4],
          "circle-opacity": ["interpolate", ["linear"], ["zoom"], 3, 0.9, 8, 0.7, 10, 0.3],
          "circle-stroke-color": "#FFFFFF",
          "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 3, 1.5, 8, 1, 10, 0.5],
        },
      });

      // === SCHOOL LAYERS ===

      // GeoJSON source — no clustering, every school is its own dot
      map.current.addSource("schools", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // School dots — brand colors, large radius
      map.current.addLayer({
        id: "schools-unclustered",
        type: "circle",
        source: "schools",
        paint: {
          "circle-color": [
            "case",
            // Charter check first (handles both string "1" and number 1)
            ["any", ["==", ["get", "charter"], 1], ["==", ["get", "charter"], "1"]],
            "#89a2a1",  // Charter → Robin's Egg 30% shade
            ["any", ["==", ["get", "schoolLevel"], 1], ["==", ["get", "schoolLevel"], "1"]],
            "#6EA3BE",  // Elementary → Steel Blue
            ["any", ["==", ["get", "schoolLevel"], 2], ["==", ["get", "schoolLevel"], "2"]],
            "#403770",  // Middle → Plum
            ["any", ["==", ["get", "schoolLevel"], 3], ["==", ["get", "schoolLevel"], "3"]],
            "#FFCF70",  // High → Golden
            "#6EA3BE",  // Default → Steel Blue
          ] as any,
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            SCHOOL_MIN_ZOOM, 7,
            12, 11,
            15, 14,
          ],
          "circle-opacity": 0.9,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#ffffff",
        },
        minzoom: SCHOOL_MIN_ZOOM,
      });

      // === OVERLAY LAYERS (map planning overlays) ===

      // Plan polygon source + layers (rendered below pin layers)
      map.current.addSource(PLANS_SOURCE, createGeoJSONSource());
      for (const layer of getPlanLayers()) {
        map.current.addLayer(layer);
      }

      // Contacts pin source + layers
      map.current.addSource(CONTACTS_SOURCE, createClusteredSource());
      for (const layer of getContactLayers()) {
        map.current.addLayer(layer);
      }

      // Vacancies pin source + layers
      map.current.addSource(VACANCIES_SOURCE, createClusteredSource());
      for (const layer of getVacancyLayers()) {
        map.current.addLayer(layer);
      }

      // Activities pin source + layers
      map.current.addSource(ACTIVITIES_SOURCE, createClusteredSource());
      for (const layer of getActivityLayers()) {
        map.current.addLayer(layer);
      }

      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      mapV2Refs[refKey] = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Clear hover — accesses store via getState(), no subscriptions needed
  const clearHover = useCallback(() => {
    if (!map.current) return;
    lastHoveredLeaidRef.current = null;
    map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("state-hover", ["==", ["get", "name"], ""]);
    // Multi-select is always-on — keep crosshair cursor
    map.current.getCanvas().style.cursor = "crosshair";
    useMapV2Store.getState().hideTooltip();
  }, []);

  // Update school bounds from current viewport (triggers useSchoolGeoJSON re-fetch)
  const updateSchoolBounds = useCallback(() => {
    if (!map.current || !mapReady) return;
    if (map.current.getZoom() < SCHOOL_MIN_ZOOM) {
      setSchoolBounds(null);
      return;
    }
    const b = map.current.getBounds();
    setSchoolBounds([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  }, [mapReady]);

  // Handle hover with priority-based hit testing.
  // Priority order: overlay pins > plans > schools > districts > states.
  // When cursor is over a pin, suppress district hover highlight.
  const handleDistrictHover = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !mapReady) return;

      // Skip hover processing during pan/zoom — tooltip cleared by movestart listener
      if (map.current.isMoving()) return;

      const now = Date.now();
      const throttled = now - lastHoverTimeRef.current < HOVER_THROTTLE_MS;
      if (!throttled) lastHoverTimeRef.current = now;

      // When a tooltip is visible, always process so we can clear it promptly.
      // When no tooltip is showing, throttle to reduce queryRenderedFeatures calls.
      if (throttled && !useMapV2Store.getState().tooltip.visible) return;

      // Helper: suppress district hover highlight when a higher-priority layer matches
      const suppressDistrictHover = () => {
        lastHoveredLeaidRef.current = null;
        map.current!.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
        map.current!.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
      };

      // Helper: query a single layer if it exists
      const queryLayer = (layerId: string) => {
        if (!map.current!.getLayer(layerId)) return [];
        return map.current!.queryRenderedFeatures(e.point, { layers: [layerId] });
      };

      // --- Priority 1-3: Overlay pin layers (activities > vacancies > contacts) ---
      for (const pointLayerId of ALL_OVERLAY_POINT_LAYERS) {
        const features = queryLayer(pointLayerId);
        if (features.length > 0) {
          const feature = features[0];
          const overlayType = layerIdToOverlayType(feature.layer.id);
          const props = feature.properties;
          suppressDistrictHover();
          map.current.getCanvas().style.cursor = "pointer";

          const typeLabels: Record<string, string> = {
            contacts: "Contact",
            vacancies: "Vacancy",
            activities: "Activity",
          };
          const typeLabel = overlayType ? typeLabels[overlayType] ?? "" : "";
          const name = props?.name || props?.title || "Unknown";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "district", // Reuse the district tooltip type for overlays
            name: `${typeLabel}: ${name}`,
            leaid: props?.leaid,
          });
          return;
        }
      }

      // --- Priority 4: Plan polygon ---
      {
        const planFeatures = queryLayer(PLANS_FILL_LAYER);
        if (planFeatures.length > 0) {
          const props = planFeatures[0].properties;
          suppressDistrictHover();
          map.current.getCanvas().style.cursor = "pointer";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "district",
            name: `Plan: ${props?.planName || "Untitled"}`,
            leaid: props?.leaid,
          });
          return;
        }
      }

      // --- Priority 5: School pins ---
      {
        const schoolFeatures = queryLayer("schools-unclustered");
        if (schoolFeatures.length > 0) {
          const props = schoolFeatures[0].properties;
          suppressDistrictHover();
          map.current.getCanvas().style.cursor = "crosshair";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "school",
            name: props?.name || "Unknown School",
            leaid: props?.leaid,
            enrollment: Number(props?.enrollment) || 0,
            schoolLevel: Number(props?.schoolLevel) || 4,
            lograde: props?.lograde,
            higrade: props?.higrade,
          });
          return;
        }
      }

      // --- Priority 6: District base fill ---
      {
        const features = queryLayer("district-base-fill");
        if (features.length > 0) {
          const feature = features[0];
          const leaid = feature.properties?.leaid;

          // Skip hover on filtered-out districts when search is active
          if (leaid && useMapV2Store.getState().isSearchActive && searchResultSetRef.current.size > 0 && !searchResultSetRef.current.has(leaid)) {
            if (lastHoveredLeaidRef.current) clearHover();
            return;
          }

          if (leaid && leaid !== lastHoveredLeaidRef.current) {
            lastHoveredLeaidRef.current = leaid;

            map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], leaid]);
            map.current.setFilter("district-hover", ["==", ["get", "leaid"], leaid]);
            map.current.getCanvas().style.cursor = "crosshair";

            // Build tooltip data, respecting tooltipPropertyMap for compare mode
            const props = feature.properties;
            const tooltipData: import("@/features/map/lib/store").V2TooltipData = {
              type: "district",
              leaid,
              name: props?.name || "Unknown",
              stateAbbrev: props?.state_abbrev,
              enrollment: props?.enrollment,
              salesExecutive: props?.sales_executive_name,
            };

            if (tooltipPropertyMap) {
              // Compare / changes mode: read _a / _b properties
              const catPropA = tooltipPropertyMap["fullmind_category_a"] || "fullmind_category_a";
              const catPropB = tooltipPropertyMap["fullmind_category_b"] || "fullmind_category_b";
              tooltipData.customerCategoryA = props?.[catPropA] || undefined;
              tooltipData.customerCategoryB = props?.[catPropB] || undefined;
              tooltipData.transitionBucket = classifyTransition(
                tooltipData.customerCategoryA ?? null,
                tooltipData.customerCategoryB ?? null,
              );
            } else {
              tooltipData.customerCategory = props?.fullmind_category;
            }

            useMapV2Store.getState().showTooltip(e.point.x, e.point.y, tooltipData);
          } else if (leaid === lastHoveredLeaidRef.current) {
            // Same district — update tooltip position directly via DOM, no store write
            if (tooltipElRef.current) {
              tooltipElRef.current.style.left = `${e.point.x + 12}px`;
              tooltipElRef.current.style.top = `${e.point.y - 8}px`;
            }
          }
          return;
        }
      }

      // --- Priority 7: State fill (low zoom only) ---
      if (map.current.getZoom() < 6) {
        const stateFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: ["state-fill"],
        });

        if (stateFeatures.length > 0) {
          const stateName = stateFeatures[0].properties?.name;
          const stateCode = STATE_NAME_TO_ABBREV[stateName];
          if (stateName) {
            map.current.setFilter("state-hover", ["==", ["get", "name"], stateName]);
            map.current.getCanvas().style.cursor = "crosshair";
            useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
              type: "state",
              stateName,
              stateCode,
            });
            return;
          }
        }
      }

      // Nothing matched — clear hover
      clearHover();
    },
    [mapReady, clearHover]
  );

  // Handle map click with priority-based hit testing.
  // Priority order (first match wins):
  //   1. overlay-activities-point   → setActiveResultsTab("activities")
  //   2. overlay-vacancies-point    → setActiveResultsTab("vacancies")
  //   3. overlay-contacts-point     → setActiveResultsTab("contacts")
  //   4. overlay-plans-fill         → setActiveResultsTab("plans")
  //   5. schools-unclustered        → existing behavior
  //   6. district-base-fill         → existing behavior
  //   7. state-fill                 → existing behavior
  // Overlay cluster clicks are also handled (zoom into cluster).
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !mapReady) return;

      // Helper: query a single layer if it exists
      const queryLayer = (layerId: string) => {
        if (!map.current!.getLayer(layerId)) return [];
        return map.current!.queryRenderedFeatures(e.point, { layers: [layerId] });
      };

      // --- Priority 1-3: Overlay pin layers in hit-test priority order ---
      for (const pointLayerId of ALL_OVERLAY_POINT_LAYERS) {
        const features = queryLayer(pointLayerId);
        if (features.length > 0) {
          const feature = features[0];
          const overlayType = layerIdToOverlayType(feature.layer.id);
          const featureId = feature.properties?.id;
          if (overlayType && featureId) {
            const store = useMapV2Store.getState();
            store.addClickRipple(e.point.x, e.point.y, "coral");
            // Switch results panel to the clicked entity's tab
            store.setActiveResultsTab(overlayType);
            const panelType = overlayTypeToPanel(overlayType) as RightPanelContent["type"];
            store.openRightPanel({ type: panelType, id: String(featureId) });
          }
          return;
        }
      }

      // --- Overlay cluster clicks — extract leaves or zoom into the cluster ---
      const overlayClusterLayers = ALL_OVERLAY_CLUSTER_LAYERS.filter(
        (id) => map.current!.getLayer(id)
      );
      if (overlayClusterLayers.length > 0) {
        const clusterFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: [...overlayClusterLayers],
        });
        if (clusterFeatures.length > 0) {
          const feature = clusterFeatures[0];
          const clusterId = feature.properties?.cluster_id;
          const sourceId = feature.source;
          if (clusterId !== undefined && sourceId) {
            const source = map.current.getSource(sourceId) as maplibregl.GeoJSONSource;
            const overlayType = layerIdToOverlayType(feature.layer.id);

            if (overlayType === "vacancies") {
              // Extract all vacancy features from the cluster and populate results panel
              Promise.all([
                source.getClusterLeaves(clusterId, Infinity, 0),
                source.getClusterExpansionZoom(clusterId),
              ]).then(([leaves, zoom]) => {
                if (!map.current) return;
                const ids = leaves
                  .map((f) => f.properties?.id as string | undefined)
                  .filter((id): id is string => !!id);
                const store = useMapV2Store.getState();
                store.setPinnedVacancyIds(ids);
                store.openResultsPanel("vacancies");
                store.addClickRipple(e.point.x, e.point.y, "coral");
                const geom = feature.geometry;
                if (geom.type === "Point") {
                  map.current.easeTo({
                    center: geom.coordinates as [number, number],
                    zoom: Math.min(zoom + 1, 12),
                    duration: 500,
                    padding: { top: 50, bottom: 50, left: 0, right: map.current.getContainer().clientWidth * 0.4 },
                  });
                }
              });
            } else {
              // For other overlay clusters (contacts, activities), zoom into the cluster
              source.getClusterExpansionZoom(clusterId).then((zoom) => {
                if (!map.current) return;
                const geom = feature.geometry;
                if (geom.type === "Point") {
                  map.current.easeTo({
                    center: geom.coordinates as [number, number],
                    zoom: zoom + 1,
                    duration: 500,
                  });
                }
              });
            }
          }
          return;
        }
      }

      // --- Priority 4: Plan polygon click ---
      {
        const planFeatures = queryLayer(PLANS_FILL_LAYER);
        if (planFeatures.length > 0) {
          const planId = planFeatures[0].properties?.planId;
          if (planId) {
            const store = useMapV2Store.getState();
            store.addClickRipple(e.point.x, e.point.y, "plum");
            store.setActiveResultsTab("plans");
            store.openRightPanel({ type: "plan_card", id: planId });
            return;
          }
        }
      }

      // --- Priority 5: School pins ---
      {
        const schoolFeatures = queryLayer("schools-unclustered");
        if (schoolFeatures.length > 0) {
          const leaid = schoolFeatures[0].properties?.leaid;
          if (leaid) {
            const store = useMapV2Store.getState();
            store.addClickRipple(e.point.x, e.point.y, "coral");
            store.selectDistrict(leaid);
            store.toggleDistrictSelection(leaid);
            store.openResultsPanel("districts");
          }
          return;
        }
      }

      // --- Priority 6: District base fill ---
      {
        const districtFeatures = queryLayer("district-base-fill");
        if (districtFeatures.length > 0) {
          const picked = pickDistrictFeature(districtFeatures);
          const leaid = picked?.properties?.leaid;
          if (!leaid) return;

          const store = useMapV2Store.getState();

          // Visual feedback
          store.addClickRipple(e.point.x, e.point.y, "plum");

          // In PLAN_ADD mode, shift+click or regular click adds to plan
          if (store.panelState === "PLAN_ADD") {
            store.addDistrictToPlan(leaid);
            return;
          }

          // Multi-select is always-on — every click toggles selection
          store.toggleLeaidSelection(leaid);
          store.toggleDistrictSelection(leaid);
          store.openResultsPanel("districts");

          // Zoom to district
          const bounds = picked?.geometry;
          if (bounds && (bounds.type === "Polygon" || bounds.type === "MultiPolygon")) {
            // Compute a rough bounding box from coordinates
            const coords = bounds.type === "Polygon"
              ? bounds.coordinates[0]
              : bounds.coordinates.flat(1)[0] || [];

            if (coords && Array.isArray(coords) && coords.length > 0) {
              let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
              for (const c of coords) {
                const coord = c as [number, number];
                if (coord[0] < minLng) minLng = coord[0];
                if (coord[0] > maxLng) maxLng = coord[0];
                if (coord[1] < minLat) minLat = coord[1];
                if (coord[1] > maxLat) maxLat = coord[1];
              }
              map.current.fitBounds(
                [[minLng, minLat], [maxLng, maxLat]],
                { padding: { top: 80, bottom: 80, left: 80, right: map.current.getContainer().clientWidth * 0.4 + 80 }, maxZoom: 9, duration: 800 }
              );
            }
          }
          return;
        }
      }

      // --- Priority 7: State fill (low zoom only) ---
      if (map.current.getZoom() < 6) {
        const stateFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: ["state-fill"],
        });

        if (stateFeatures.length > 0) {
          const stateName = stateFeatures[0].properties?.name;
          const stateCode = STATE_NAME_TO_ABBREV[stateName];
          if (stateCode && STATE_BBOX[stateCode]) {
            const store = useMapV2Store.getState();
            store.addClickRipple(e.point.x, e.point.y, "coral");
            store.selectState(stateCode);
            map.current.fitBounds(STATE_BBOX[stateCode], {
              padding: { top: 50, bottom: 50, left: 380, right: 50 },
              duration: 800,
            });
          }
        }
      }
    },
    [mapReady]
  );

  // Attach/detach event handlers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    map.current.on("mousemove", handleDistrictHover);
    map.current.on("click", handleClick);
    map.current.on("mouseleave", clearHover);
    map.current.on("movestart", clearHover);

    // Update school bounds + search bounds on viewport change (debounced)
    let boundsDebounceTimer: ReturnType<typeof setTimeout>;
    const handleMoveEnd = () => {
      clearTimeout(boundsDebounceTimer);
      boundsDebounceTimer = setTimeout(() => {
        updateSchoolBounds();

        const m = map.current;
        if (!m) return;
        const bounds = m.getBounds();
        const boundsArray: [number, number, number, number] = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ];
        const store = useMapV2Store.getState();
        store.setSearchBounds(boundsArray);
        store.setMapBounds(boundsArray);
      }, 300);
    };
    map.current.on("moveend", handleMoveEnd);

    // Initial bounds
    updateSchoolBounds();
    if (map.current) {
      const bounds = map.current.getBounds();
      const boundsArray: [number, number, number, number] = [
        bounds.getWest(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getNorth(),
      ];
      const store = useMapV2Store.getState();
      store.setSearchBounds(boundsArray);
      store.setMapBounds(boundsArray);
    }

    return () => {
      const m = map.current;
      m?.off("mousemove", handleDistrictHover);
      m?.off("click", handleClick);
      m?.off("mouseleave", clearHover);
      m?.off("movestart", clearHover);
      m?.off("moveend", handleMoveEnd);
      clearTimeout(boundsDebounceTimer);
    };
  }, [mapReady, handleDistrictHover, handleClick, clearHover, updateSchoolBounds]);

  // Update selected district highlight
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter: ["==", ["get", string], string] = selectedLeaid
      ? ["==", ["get", "leaid"], selectedLeaid]
      : ["==", ["get", "leaid"], ""];
    map.current.setFilter("district-selected-fill", filter);
    map.current.setFilter("district-selected", filter);
  }, [selectedLeaid, mapReady]);

  // Update multi-select highlight
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const leaidArray = [...selectedLeaids];
    const filter: any = leaidArray.length > 0
      ? ["in", ["get", "leaid"], ["literal", leaidArray]]
      : ["in", ["get", "leaid"], ["literal", [""]]];
    if (map.current.getLayer("district-multiselect-fill")) {
      map.current.setFilter("district-multiselect-fill", filter);
    }
    if (map.current.getLayer("district-multiselect-outline")) {
      map.current.setFilter("district-multiselect-outline", filter);
    }
  }, [selectedLeaids, mapReady]);

  // Update focus highlight layers — show plan districts with colored fill + outline
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter: any = focusLeaids.length > 0
      ? ["in", ["get", "leaid"], ["literal", focusLeaids]]
      : ["in", ["get", "leaid"], ["literal", [""]]];
    if (map.current.getLayer("district-focus-fill")) {
      map.current.setFilter("district-focus-fill", filter);
    }
    if (map.current.getLayer("district-focus-outline")) {
      map.current.setFilter("district-focus-outline", filter);
    }
  }, [focusLeaids, mapReady]);

  // Search result highlighting — outline matching districts + dim non-matching
  const searchResultLeaids = useMapV2Store((s) => s.searchResultLeaids);
  const isSearchActive = useMapV2Store((s) => s.isSearchActive);

  // Keep a Set version of search results for O(1) hover lookups
  useEffect(() => {
    searchResultSetRef.current = new Set(searchResultLeaids);
  }, [searchResultLeaids]);

  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (isSearchActive && searchResultLeaids.length > 0) {
      const matchFilter: any = ["in", ["get", "leaid"], ["literal", searchResultLeaids]];
      const noMatchFilter: any = ["!", matchFilter];

      // Bold coral outline on matching districts — scales with zoom
      if (map.current.getLayer("district-search-outline")) {
        map.current.setFilter("district-search-outline", matchFilter);
        map.current.setPaintProperty("district-search-outline", "line-opacity", 0.9);
        map.current.setPaintProperty("district-search-outline", "line-width", [
          "interpolate", ["linear"], ["zoom"],
          4, 1.5,   // thin at country level
          6, 2,     // medium at multi-state
          8, 2.5,   // standard at state level
          10, 3,    // bold at county level
        ]);
      }
      // Coral tint fill on matching districts — stronger at low zoom where outlines are thin
      if (map.current.getLayer("district-search-fill")) {
        map.current.setFilter("district-search-fill", matchFilter);
        map.current.setPaintProperty("district-search-fill", "fill-opacity", [
          "interpolate", ["linear"], ["zoom"],
          4, 0.35,   // strong fill at low zoom (outlines hard to see)
          7, 0.25,   // moderate at state level
          10, 0.12,  // subtle at close zoom (outlines do the work)
        ]);
      }
      // Heavy dim on non-matching districts
      if (map.current.getLayer("district-search-dim")) {
        map.current.setFilter("district-search-dim", noMatchFilter);
        map.current.setPaintProperty("district-search-dim", "fill-opacity", 0.8);
      }
    } else {
      // Hide all search layers
      const emptyFilter: any = ["in", ["get", "leaid"], ["literal", [""]]];
      if (map.current.getLayer("district-search-outline")) {
        map.current.setFilter("district-search-outline", emptyFilter);
        map.current.setPaintProperty("district-search-outline", "line-opacity", 0);
      }
      if (map.current.getLayer("district-search-fill")) {
        map.current.setFilter("district-search-fill", emptyFilter);
        map.current.setPaintProperty("district-search-fill", "fill-opacity", 0);
      }
      if (map.current.getLayer("district-search-dim")) {
        map.current.setPaintProperty("district-search-dim", "fill-opacity", 0);
      }
    }
  }, [searchResultLeaids, isSearchActive, mapReady]);

  // Update search centroid dots — coral dots at district centers, visible at all zoom levels
  const searchResultCentroids = useMapV2Store((s) => s.searchResultCentroids);
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource("search-centroids") as any;
    if (!source) return;

    if (isSearchActive && searchResultCentroids.length > 0) {
      source.setData({
        type: "FeatureCollection",
        features: searchResultCentroids.map((c) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [c.lng, c.lat] },
          properties: { leaid: c.leaid },
        })),
      });
    } else {
      source.setData({ type: "FeatureCollection", features: [] });
    }
  }, [searchResultCentroids, isSearchActive, mapReady]);

  // Sync store hoveredLeaid → map hover highlight (for search card hover)
  const storeHoveredLeaid = useMapV2Store((s) => s.hoveredLeaid);
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter: any = storeHoveredLeaid
      ? ["==", ["get", "leaid"], storeHoveredLeaid]
      : ["==", ["get", "leaid"], ""];
    if (map.current.getLayer("district-hover-fill")) {
      map.current.setFilter("district-hover-fill", filter);
    }
    if (map.current.getLayer("district-hover")) {
      map.current.setFilter("district-hover", filter);
    }
  }, [storeHoveredLeaid, mapReady]);

  // Multi-select is always-on — always show crosshair cursor
  useEffect(() => {
    if (!map.current || !mapReady) return;
    map.current.getCanvas().style.cursor = "crosshair";
  }, [mapReady]);

  // Update tile source when fiscal year changes (or fyOverride / tileUrlSuffix)
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource("districts") as any;
    if (!source) return;

    const effectiveFy = fyOverride ?? selectedFiscalYear;
    const suffix = tileUrlSuffix ?? "";
    const newUrl = `${window.location.origin}/api/tiles/{z}/{x}/{y}?v=8&fy=${effectiveFy}${suffix}`;
    source.setTiles([newUrl]);
  }, [selectedFiscalYear, fyOverride, tileUrlSuffix, mapReady]);

  // Toggle vendor layer visibility + update circle layer color
  useEffect(() => {
    if (!map.current || !mapReady) return;
    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (map.current.getLayer(layerId)) {
        map.current.setLayoutProperty(
          layerId,
          "visibility",
          activeVendors.has(vendorId) ? "visible" : "none"
        );
      }
    }

    // Update circle layer color to match active vendor
    if (map.current.getLayer(ACCOUNT_POINT_LAYER_ID)) {
      const pointLayer = buildAccountPointLayer(activeVendors);
      map.current.setPaintProperty(
        ACCOUNT_POINT_LAYER_ID,
        "circle-color",
        pointLayer.paint!["circle-color"] as any,
      );
    }
  }, [activeVendors, mapReady]);

  // Update vendor layer colors when per-category colors change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    const isChangesMode = !!tileUrlSuffix?.includes("fy2=");

    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      // In changes mode, use transition fill expression; otherwise normal category colors
      const fillExpr = isChangesMode
        ? buildTransitionFillExpression(vendorId) as any
        : buildVendorFillExpressionFromCategories(vendorId, categoryColors) as any;
      map.current.setPaintProperty(layerId, "fill-color", fillExpr);
    }

    // Update account point layer too (not applicable in changes mode)
    if (!isChangesMode && map.current.getLayer(ACCOUNT_POINT_LAYER_ID)) {
      const firstVendor = [...useMapV2Store.getState().activeVendors][0];
      if (firstVendor) {
        map.current.setPaintProperty(
          ACCOUNT_POINT_LAYER_ID,
          "circle-color",
          buildVendorFillExpressionFromCategories(firstVendor, categoryColors) as any,
        );
      }
    }
  }, [categoryColors, mapReady, tileUrlSuffix]);

  // Update vendor layer opacity when per-category opacities change
  useEffect(() => {
    if (!map.current || !mapReady) return;

    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      map.current.setPaintProperty(
        layerId,
        "fill-opacity",
        buildCategoryOpacityExpression(vendorId, categoryOpacities) as any,
      );
    }
  }, [categoryOpacities, mapReady]);

  // Toggle signal layer — swap paint properties based on active signal
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (!map.current.getLayer("district-signal-fill")) return;

    if (!activeSignal) {
      map.current.setLayoutProperty("district-signal-fill", "visibility", "none");
      return;
    }

    const config = SIGNAL_CONFIGS[activeSignal];
    const sigPalette = getSignalPalette(signalPalette);
    map.current.setLayoutProperty("district-signal-fill", "visibility", "visible");
    map.current.setPaintProperty(
      "district-signal-fill",
      "fill-color",
      buildSignalFillExpressionFromCategories(activeSignal, categoryColors) as any,
    );
    map.current.setPaintProperty(
      "district-signal-fill",
      "fill-opacity",
      buildCategoryOpacityExpression(activeSignal, categoryOpacities) as any,
    );

    // Apply combined filter (signal property exists + user filters + account type
    // + rollup exclusion). Rollups never receive signal fills — they absorb clicks.
    const userFilter = buildFilterExpression(filterOwner, filterPlanId, filterStates);
    const signalConditions: any[] = [["has", config.tileProperty], NOT_ROLLUP_FILTER];
    if (userFilter) signalConditions.push(userFilter);
    if (filterAccountTypes.length > 0) {
      const includesDistrict = filterAccountTypes.includes("district");
      if (includesDistrict) {
        signalConditions.push(["any", ["!", ["has", "account_type"]], ["in", ["get", "account_type"], ["literal", filterAccountTypes]]]);
      } else {
        signalConditions.push(["all", ["has", "account_type"], ["in", ["get", "account_type"], ["literal", filterAccountTypes]]]);
      }
    }
    const combined = signalConditions.length === 1
      ? signalConditions[0]
      : ["all", ...signalConditions];
    map.current.setFilter("district-signal-fill", combined);
  }, [activeSignal, signalPalette, categoryColors, categoryOpacities, filterOwner, filterPlanId, filterStates, filterAccountTypes, mapReady]);

  // Toggle locale layer — filter by selected locale types
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (!map.current.getLayer("district-locale-fill")) return;

    if (visibleLocales.size === 0) {
      map.current.setLayoutProperty("district-locale-fill", "visibility", "none");
      return;
    }

    map.current.setLayoutProperty("district-locale-fill", "visibility", "visible");

    // Build combined filter: locale value in selected set + user filters + account type
    // + rollup exclusion. Rollups never receive locale fills — they absorb clicks.
    const userFilter = buildFilterExpression(filterOwner, filterPlanId, filterStates);
    const localeValues = [...visibleLocales];
    const localeConditions: any[] = [NOT_ROLLUP_FILTER];
    localeConditions.push(
      visibleLocales.size === ALL_LOCALE_IDS.length
        ? ["has", "locale_signal"]
        : ["in", ["get", "locale_signal"], ["literal", localeValues]]
    );
    if (userFilter) localeConditions.push(userFilter);
    if (filterAccountTypes.length > 0) {
      const includesDistrict = filterAccountTypes.includes("district");
      if (includesDistrict) {
        localeConditions.push(["any", ["!", ["has", "account_type"]], ["in", ["get", "account_type"], ["literal", filterAccountTypes]]]);
      } else {
        localeConditions.push(["all", ["has", "account_type"], ["in", ["get", "account_type"], ["literal", filterAccountTypes]]]);
      }
    }
    const combined = localeConditions.length === 1
      ? localeConditions[0]
      : ["all", ...localeConditions];
    map.current.setFilter("district-locale-fill", combined);
  }, [visibleLocales, filterOwner, filterPlanId, filterStates, filterAccountTypes, mapReady]);

  // Toggle schools layer visibility + filter by selected types
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const layer = map.current.getLayer("schools-unclustered");
    if (!layer) return;

    const anyVisible = visibleSchoolTypes.size > 0;
    map.current.setLayoutProperty(
      "schools-unclustered",
      "visibility",
      anyVisible ? "visible" : "none",
    );

    if (anyVisible) {
      // Build filter — handle both string and number property types
      const isCharter = ["any", ["==", ["get", "charter"], 1], ["==", ["get", "charter"], "1"]];
      const notCharter = ["all", ["!=", ["get", "charter"], 1], ["!=", ["get", "charter"], "1"]];
      const isLevel = (n: number) => ["any", ["==", ["get", "schoolLevel"], n], ["==", ["get", "schoolLevel"], String(n)]];

      const conditions: any[] = [];
      if (visibleSchoolTypes.has("elementary")) {
        conditions.push(["all", isLevel(1), notCharter]);
      }
      if (visibleSchoolTypes.has("middle")) {
        conditions.push(["all", isLevel(2), notCharter]);
      }
      if (visibleSchoolTypes.has("high")) {
        conditions.push(["all", isLevel(3), notCharter]);
      }
      if (visibleSchoolTypes.has("charter")) {
        conditions.push(isCharter);
      }

      if (conditions.length === 1) {
        map.current.setFilter("schools-unclustered", conditions[0]);
      } else {
        map.current.setFilter("schools-unclustered", ["any", ...conditions]);
      }

      updateSchoolBounds();
    }
  }, [visibleSchoolTypes, mapReady, updateSchoolBounds]);

  // Apply filter expression to all layers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const userFilter = buildFilterExpression(filterOwner, filterPlanId, filterStates);

    // Build account type filter expression
    // Empty array = show all (no filter), non-empty = restrict to selected types
    let accountTypeFilter: any = null;
    if (filterAccountTypes.length > 0) {
      const includesDistrict = filterAccountTypes.includes("district");
      if (includesDistrict) {
        // Show selected types, plus tiles without account_type (legacy = district)
        accountTypeFilter = ["any",
          ["!", ["has", "account_type"]],
          ["in", ["get", "account_type"], ["literal", filterAccountTypes]],
        ];
      } else {
        // Only show tiles that have account_type matching selected types
        accountTypeFilter = ["all",
          ["has", "account_type"],
          ["in", ["get", "account_type"], ["literal", filterAccountTypes]],
        ];
      }
    }

    // Combine user filter + account type filter. Rollups (e.g., NYC DOE) are
    // always excluded from fill layers so they don't absorb clicks — see
    // NOT_ROLLUP_FILTER in layers.ts.
    const conditions: any[] = [NOT_ROLLUP_FILTER];
    if (userFilter) conditions.push(userFilter);
    if (accountTypeFilter) conditions.push(accountTypeFilter);
    const combinedFilter = conditions.length === 1
      ? conditions[0]
      : ["all", ...conditions];

    // Apply to base layers
    map.current.setFilter("district-base-fill", combinedFilter);
    map.current.setFilter("district-base-boundary", combinedFilter);

    // Apply to each vendor layer (combine with the vendor's own "has" filter)
    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      const config = VENDOR_CONFIGS[vendorId];

      // For fullmind, add engagement filter when active
      if (vendorId === "fullmind" && fullmindEngagement.length > 0) {
        const categories = engagementToCategories(fullmindEngagement);
        const engagementFilter: any = ["in", ["get", "fullmind_category"], ["literal", categories]];
        const combined = combinedFilter
          ? ["all", engagementFilter, combinedFilter]
          : engagementFilter;
        map.current.setFilter(layerId, combined);
      } else if (vendorId !== "fullmind" && (competitorEngagement[vendorId]?.length ?? 0) > 0) {
        // Per-competitor engagement filter — expand engagement names to DB category values
        const categories = engagementToCategories(competitorEngagement[vendorId]);
        const engagementFilter: any = ["in", ["get", config.tileProperty], ["literal", categories]];
        const combined = combinedFilter
          ? ["all", engagementFilter, combinedFilter]
          : engagementFilter;
        map.current.setFilter(layerId, combined);
      } else {
        const vendorFilter: any = ["has", config.tileProperty];
        const combined = combinedFilter
          ? ["all", vendorFilter, combinedFilter]
          : vendorFilter;
        map.current.setFilter(layerId, combined);
      }
    }

    // Apply to account points circle layer (combine with non-district filter)
    if (map.current.getLayer(ACCOUNT_POINT_LAYER_ID)) {
      const pointBaseFilter: any = ["all", ["has", "account_type"], ["!=", ["get", "account_type"], "district"]];

      // For account type filter on points: if filtering, further restrict which point types show
      let pointFilter: any = pointBaseFilter;
      if (filterAccountTypes.length > 0) {
        // Only show point accounts whose type is in the selected set
        const nonDistrictTypes = filterAccountTypes.filter((t) => t !== "district");
        if (nonDistrictTypes.length === 0) {
          // Only "district" is selected — hide all point accounts
          pointFilter = ["==", ["get", "account_type"], "__none__"];
        } else {
          pointFilter = ["all",
            ["has", "account_type"],
            ["in", ["get", "account_type"], ["literal", nonDistrictTypes]],
          ];
        }
      }

      const pointCombined = userFilter
        ? ["all", pointFilter, userFilter]
        : pointFilter;
      map.current.setFilter(ACCOUNT_POINT_LAYER_ID, pointCombined);
    }
  }, [filterOwner, filterPlanId, filterStates, filterAccountTypes, fullmindEngagement, competitorEngagement, mapReady]);

  // Highlight filtered states with outline + subtle fill
  // Responds to BOTH the layer filterStates AND search filter state selections
  const searchFilters = useMapV2Store((s) => s.searchFilters);
  const searchStateAbbrevs = useMemo(() => {
    for (const f of searchFilters) {
      if (f.column === "state" && f.op === "in" && Array.isArray(f.value)) {
        return f.value as string[];
      }
    }
    return [] as string[];
  }, [searchFilters]);

  // Combined state filter: merge layer filterStates + search state filters
  const effectiveFilterStates = useMemo(() => {
    const combined = new Set([...filterStates, ...searchStateAbbrevs]);
    return [...combined];
  }, [filterStates, searchStateAbbrevs]);

  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (effectiveFilterStates.length === 0) {
      // No states selected — hide state highlights, show all district outlines
      map.current.setFilter("state-filter-fill", ["==", ["get", "name"], ""]);
      map.current.setFilter("state-filter-outline", ["==", ["get", "name"], ""]);

      // Restore district outlines and base fill for all districts
      if (map.current.getLayer("district-base-boundary")) {
        map.current.setPaintProperty("district-base-boundary", "line-opacity", [
          "interpolate", ["linear"], ["zoom"], 3, 0, 5, 0.15, 8, 0.3, 12, 0.5,
        ]);
      }
      if (map.current.getLayer("district-base-fill")) {
        map.current.setPaintProperty("district-base-fill", "fill-opacity", 0.08);
      }
    } else {
      const stateNames = effectiveFilterStates
        .map((abbrev) => ABBREV_TO_STATE_NAME[abbrev])
        .filter(Boolean);
      const nameFilter: any = ["in", ["get", "name"], ["literal", stateNames]];
      map.current.setFilter("state-filter-fill", nameFilter);
      map.current.setFilter("state-filter-outline", nameFilter);

      // Only show district outlines for districts in selected states
      // MapLibre requires "zoom" expressions at the top level of interpolate/step,
      // so we use interpolate at the top with per-stop case expressions.
      if (map.current.getLayer("district-base-boundary")) {
        map.current.setPaintProperty("district-base-boundary", "line-opacity", [
          "interpolate", ["linear"], ["zoom"],
          5, ["case", ["in", ["get", "state_abbrev"], ["literal", effectiveFilterStates]], 0.2, 0],
          8, ["case", ["in", ["get", "state_abbrev"], ["literal", effectiveFilterStates]], 0.4, 0],
          12, ["case", ["in", ["get", "state_abbrev"], ["literal", effectiveFilterStates]], 0.6, 0],
        ]);
      }

      // Also dim the base fill for non-selected states
      if (map.current.getLayer("district-base-fill")) {
        map.current.setPaintProperty("district-base-fill", "fill-opacity", [
          "case",
          ["in", ["get", "state_abbrev"], ["literal", effectiveFilterStates]],
          0.08,
          0, // invisible for non-selected states
        ]);
      }
    }
  }, [effectiveFilterStates, mapReady]);

  // Focus Map — fly to bounds when a focus action queues one
  useEffect(() => {
    if (!pendingFitBounds || !map.current) return;
    map.current.fitBounds(pendingFitBounds, {
      padding: { top: 50, bottom: 50, left: 380, right: 50 },
      duration: 800,
    });
    clearPendingFitBounds();
  }, [pendingFitBounds, clearPendingFitBounds]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const store = useMapV2Store.getState();
        if (store.panelState !== "BROWSE") {
          store.goBack();
        } else {
          store.clearSelection();
          map.current?.fitBounds(US_BOUNDS, { padding: 50, duration: 600 });
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);


  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Click ripples (isolated component — doesn't re-render the map) */}
      <ClickRipples />

      {/* Tooltip */}
      <MapV2Tooltip ref={tooltipElRef} />
    </div>
  );
}
