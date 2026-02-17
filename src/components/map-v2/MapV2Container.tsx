"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapV2Store } from "@/lib/map-v2-store";
import { VENDOR_CONFIGS, VENDOR_IDS, SIGNAL_CONFIGS, LOCALE_FILL, ALL_LOCALE_IDS, buildFilterExpression, ACCOUNT_POINT_LAYER_ID, buildAccountPointLayer, engagementToCategories } from "@/lib/map-v2-layers";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import { useProfile } from "@/lib/api";
import { mapV2Ref } from "@/lib/map-v2-ref";
import MapV2Tooltip from "./MapV2Tooltip";

// Throttle interval for hover handlers
const HOVER_THROTTLE_MS = 50;

const SCHOOL_MIN_ZOOM = 9;

// US bounds
const US_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-125, 24],
  [-66, 50],
];

// State bounding boxes
const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
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

export default function MapV2Container() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const homeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const schoolFetchController = useRef<AbortController | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isTouchDevice = useIsTouchDevice();
  const { data: profile } = useProfile();

  // Refs for hover optimization
  const lastHoveredLeaidRef = useRef<string | null>(null);
  const lastHoverTimeRef = useRef(0);
  const tooltipElRef = useRef<HTMLDivElement>(null);

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
  const clickRipples = useMapV2Store((s) => s.clickRipples);
  const removeClickRipple = useMapV2Store((s) => s.removeClickRipple);
  const selectedLeaids = useMapV2Store((s) => s.selectedLeaids);
  const multiSelectMode = useMapV2Store((s) => s.multiSelectMode);
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);

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
      center: [-98, 39],
      zoom: 4.2,
      minZoom: 2,
      maxZoom: 14,
    });

    mapV2Ref.current = map.current;

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Add state boundaries source
      map.current.addSource("states", {
        type: "geojson",
        data: "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",
      });

      // Add district tiles source (cache-bust via version param)
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?v=4&fy=fy26`],
        minzoom: 3.5,
        maxzoom: 12,
      });

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

      // Base fill for all districts (light gray background)
      map.current.addLayer({
        id: "district-base-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        paint: {
          "fill-color": "#E5E7EB",
          "fill-opacity": 0.4,
        },
      });

      // Base boundary for all districts
      map.current.addLayer({
        id: "district-base-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        paint: {
          "line-color": "#374151",
          "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.2, 7, 0.6, 10, 1],
          "line-opacity": 0.4,
        },
      });

      // Signal fill layer (renders below vendor layers)
      map.current.addLayer({
        id: "district-signal-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        paint: {
          "fill-color": "rgba(0,0,0,0)",
          "fill-opacity": 0,
        },
        layout: {
          visibility: "none",
        },
      });

      // Locale fill layer (renders below vendor layers, above signal)
      map.current.addLayer({
        id: "district-locale-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        minzoom: 5,
        filter: ["has", "locale_signal"],
        paint: {
          "fill-color": LOCALE_FILL as any,
          "fill-opacity": 0.55,
        },
        layout: {
          visibility: "none",
        },
      });

      // Per-vendor fill layers (stacked, semi-transparent)
      for (const vendorId of ["fullmind", "proximity", "elevate", "tbt"] as const) {
        const config = VENDOR_CONFIGS[vendorId];
        map.current.addLayer({
          id: `district-${vendorId}-fill`,
          type: "fill",
          source: "districts",
          "source-layer": "districts",
          filter: ["has", config.tileProperty],
          paint: {
            "fill-color": config.fillColor as any,
            "fill-opacity": config.fillOpacity,
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

      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      mapV2Ref.current = null;
    };
  }, []);

  // Clear hover — accesses store via getState(), no subscriptions needed
  const clearHover = useCallback(() => {
    if (!map.current) return;
    lastHoveredLeaidRef.current = null;
    map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("state-hover", ["==", ["get", "name"], ""]);
    const isMultiSelect = useMapV2Store.getState().multiSelectMode;
    map.current.getCanvas().style.cursor = isMultiSelect ? "crosshair" : "";
    useMapV2Store.getState().hideTooltip();
  }, []);

  // Load school GeoJSON for current viewport
  const loadSchoolsForViewport = useCallback(() => {
    if (!map.current || !mapReady) return;
    if (useMapV2Store.getState().visibleSchoolTypes.size === 0) return;
    if (map.current.getZoom() < SCHOOL_MIN_ZOOM) {
      // Clear schools when zoomed out
      const source = map.current.getSource("schools") as maplibregl.GeoJSONSource | undefined;
      if (source) {
        source.setData({ type: "FeatureCollection", features: [] });
      }
      return;
    }

    // Abort previous in-flight request
    if (schoolFetchController.current) {
      schoolFetchController.current.abort();
    }
    schoolFetchController.current = new AbortController();

    const bounds = map.current.getBounds();
    const boundsParam = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;

    fetch(`/api/schools/geojson?bounds=${boundsParam}`, {
      signal: schoolFetchController.current.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((geojson) => {
        if (!map.current) return;
        const source = map.current.getSource("schools") as maplibregl.GeoJSONSource | undefined;
        if (source) {
          source.setData(geojson);
        }
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load schools:", err);
        }
      });
  }, [mapReady]);

  // Handle district hover — actions via getState(), tooltip position via DOM ref
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

      // Query only the base fill layer — same source-layer, same properties, 1 layer vs 5
      const features = map.current.getLayer("district-base-fill")
        ? map.current.queryRenderedFeatures(e.point, {
            layers: ["district-base-fill"],
          })
        : [];

      if (features.length > 0) {
        const feature = features[0];
        const leaid = feature.properties?.leaid;

        if (leaid && leaid !== lastHoveredLeaidRef.current) {
          lastHoveredLeaidRef.current = leaid;

          map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], leaid]);
          map.current.setFilter("district-hover", ["==", ["get", "leaid"], leaid]);
          map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "district",
            leaid,
            name: feature.properties?.name || "Unknown",
            stateAbbrev: feature.properties?.state_abbrev,
            enrollment: feature.properties?.enrollment,
            customerCategory: feature.properties?.fullmind_category,
            salesExecutive: feature.properties?.sales_executive,
          });
        } else if (leaid === lastHoveredLeaidRef.current) {
          // Same district — update tooltip position directly via DOM, no store write
          if (tooltipElRef.current) {
            tooltipElRef.current.style.left = `${e.point.x + 12}px`;
            tooltipElRef.current.style.top = `${e.point.y - 8}px`;
          }
        }
      } else {
        // Check for school hover
        const schoolFeatures = map.current.getLayer("schools-unclustered")
          ? map.current.queryRenderedFeatures(e.point, {
              layers: ["schools-unclustered"],
            })
          : [];

        if (schoolFeatures.length > 0) {
          const props = schoolFeatures[0].properties;
          lastHoveredLeaidRef.current = null;
          map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
          map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
          map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";

          useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
            type: "school",
            name: props?.name || "Unknown School",
            leaid: props?.leaid,
            enrollment: Number(props?.enrollment) || 0,
            schoolLevel: Number(props?.schoolLevel) || 4,
            lograde: props?.lograde,
            higrade: props?.higrade,
          });
        } else if (map.current.getZoom() < 6) {
          // Check state hover at low zoom
          const stateFeatures = map.current.queryRenderedFeatures(e.point, {
            layers: ["state-fill"],
          });

          if (stateFeatures.length > 0) {
            const stateName = stateFeatures[0].properties?.name;
            const stateCode = STATE_NAME_TO_ABBREV[stateName];
            if (stateName) {
              map.current.setFilter("state-hover", ["==", ["get", "name"], stateName]);
              map.current.getCanvas().style.cursor = useMapV2Store.getState().multiSelectMode ? "crosshair" : "pointer";
              useMapV2Store.getState().showTooltip(e.point.x, e.point.y, {
                type: "state",
                stateName,
                stateCode,
              });
            }
          } else {
            clearHover();
          }
        } else {
          clearHover();
        }
      }
    },
    [mapReady, clearHover]
  );

  // Handle map click — all store access via getState()
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !mapReady) return;

      // Check for individual school click — select parent district
      const schoolFeatures = map.current.getLayer("schools-unclustered")
        ? map.current.queryRenderedFeatures(e.point, {
            layers: ["schools-unclustered"],
          })
        : [];

      if (schoolFeatures.length > 0) {
        const leaid = schoolFeatures[0].properties?.leaid;
        if (leaid) {
          const store = useMapV2Store.getState();
          store.addClickRipple(e.point.x, e.point.y, "coral");
          store.selectDistrict(leaid);
        }
        return;
      }

      // Check for district click — query base fill only (same source-layer, same properties)
      const districtFeatures = map.current.getLayer("district-base-fill")
        ? map.current.queryRenderedFeatures(e.point, {
            layers: ["district-base-fill"],
          })
        : [];

      if (districtFeatures.length > 0) {
        const leaid = districtFeatures[0].properties?.leaid;
        if (!leaid) return;

        const store = useMapV2Store.getState();

        // Visual feedback
        store.addClickRipple(e.point.x, e.point.y, "plum");

        // In PLAN_ADD mode, shift+click or regular click adds to plan
        if (store.panelState === "PLAN_ADD") {
          store.addDistrictToPlan(leaid);
          return;
        }

        // Multi-select mode or Shift+click toggles selection
        if (store.multiSelectMode || e.originalEvent.shiftKey) {
          store.toggleDistrictSelection(leaid);
          return;
        }

        // Regular click selects district
        store.selectDistrict(leaid);

        // Zoom to district
        const bounds = districtFeatures[0].geometry;
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
              { padding: { top: 50, bottom: 50, left: 380, right: 50 }, maxZoom: 11, duration: 800 }
            );
          }
        }
        return;
      }

      // Check for state click at low zoom
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

    // Load schools on viewport change (debounced)
    let schoolDebounceTimer: ReturnType<typeof setTimeout>;
    const handleMoveEnd = () => {
      clearTimeout(schoolDebounceTimer);
      schoolDebounceTimer = setTimeout(loadSchoolsForViewport, 300);
    };
    map.current.on("moveend", handleMoveEnd);

    // Initial load
    loadSchoolsForViewport();

    return () => {
      const m = map.current;
      m?.off("mousemove", handleDistrictHover);
      m?.off("click", handleClick);
      m?.off("mouseleave", clearHover);
      m?.off("movestart", clearHover);
      m?.off("moveend", handleMoveEnd);
      clearTimeout(schoolDebounceTimer);
    };
  }, [mapReady, handleDistrictHover, handleClick, clearHover, loadSchoolsForViewport]);

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

  // Change cursor in multi-select mode
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (multiSelectMode) {
      map.current.getCanvas().style.cursor = "crosshair";
    } else {
      map.current.getCanvas().style.cursor = "";
    }
  }, [multiSelectMode, mapReady]);

  // Update tile source when fiscal year changes
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const source = map.current.getSource("districts") as any;
    if (!source) return;

    const newUrl = `${window.location.origin}/api/tiles/{z}/{x}/{y}?v=4&fy=${selectedFiscalYear}`;
    source.setTiles([newUrl]);

    // Clear tile cache and force re-fetch
    const sourceCache = (map.current.style as any)?._sourceCaches?.["districts"];
    if (sourceCache?.clearTiles) {
      sourceCache.clearTiles();
    }
    map.current.triggerRepaint();
  }, [selectedFiscalYear, mapReady]);

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

  // Toggle signal layer — swap paint properties based on active signal
  useEffect(() => {
    if (!map.current || !mapReady) return;
    if (!map.current.getLayer("district-signal-fill")) return;

    if (!activeSignal) {
      map.current.setLayoutProperty("district-signal-fill", "visibility", "none");
      return;
    }

    const config = SIGNAL_CONFIGS[activeSignal];
    map.current.setLayoutProperty("district-signal-fill", "visibility", "visible");
    map.current.setPaintProperty("district-signal-fill", "fill-color", config.fillColor as any);
    map.current.setPaintProperty("district-signal-fill", "fill-opacity", config.fillOpacity);

    // Apply combined filter (signal property exists + user filters + account type)
    const userFilter = buildFilterExpression(filterOwner, filterPlanId, filterStates);
    const signalConditions: any[] = [["has", config.tileProperty]];
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
  }, [activeSignal, filterOwner, filterPlanId, filterStates, filterAccountTypes, mapReady]);

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
    const userFilter = buildFilterExpression(filterOwner, filterPlanId, filterStates);
    const localeValues = [...visibleLocales];
    const localeConditions: any[] = [];
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

      loadSchoolsForViewport();
    }
  }, [visibleSchoolTypes, mapReady, loadSchoolsForViewport]);

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

    // Combine user filter + account type filter
    const conditions: any[] = [];
    if (userFilter) conditions.push(userFilter);
    if (accountTypeFilter) conditions.push(accountTypeFilter);
    const combinedFilter = conditions.length === 0
      ? null
      : conditions.length === 1
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
        // Per-competitor engagement filter — category values match directly (multi_year, new, churned)
        const engagementFilter: any = ["in", ["get", config.tileProperty], ["literal", competitorEngagement[vendorId]]];
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
  useEffect(() => {
    if (!map.current || !mapReady) return;

    if (filterStates.length === 0) {
      // No states selected — hide highlights
      map.current.setFilter("state-filter-fill", ["==", ["get", "name"], ""]);
      map.current.setFilter("state-filter-outline", ["==", ["get", "name"], ""]);
    } else {
      const stateNames = filterStates
        .map((abbrev) => ABBREV_TO_STATE_NAME[abbrev])
        .filter(Boolean);
      const nameFilter: any = ["in", ["get", "name"], ["literal", stateNames]];
      map.current.setFilter("state-filter-fill", nameFilter);
      map.current.setFilter("state-filter-outline", nameFilter);
    }
  }, [filterStates, mapReady]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const store = useMapV2Store.getState();
        // Exit multi-select mode first
        if (store.multiSelectMode) {
          store.toggleMultiSelectMode();
          return;
        }
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

  // Home marker
  useEffect(() => {
    if (!map.current || !mapReady) return;

    // Remove old marker
    if (homeMarkerRef.current) {
      homeMarkerRef.current.remove();
      homeMarkerRef.current = null;
    }

    if (!profile?.locationLat || !profile?.locationLng) return;

    // Create custom marker element
    const el = document.createElement("div");
    el.className = "home-marker";
    el.style.cssText = `
      width: 32px; height: 32px; border-radius: 50%;
      background: #403770; border: 2px solid white;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 2px 8px rgba(64,55,112,0.4);
      cursor: pointer; transition: transform 0.15s ease;
    `;
    el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.15)"; });
    el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([profile.locationLng, profile.locationLat])
      .setPopup(
        new maplibregl.Popup({ offset: 20, closeButton: false, className: "home-popup" })
          .setHTML(`<div style="font-size:12px;font-weight:600;color:#403770;">Home &mdash; ${profile.location || "My Location"}</div>`)
      )
      .addTo(map.current);

    homeMarkerRef.current = marker;

    return () => {
      marker.remove();
    };
  }, [mapReady, profile?.locationLat, profile?.locationLng, profile?.location]);

  return (
    <div className="absolute inset-0">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Click ripples */}
      {clickRipples.map((ripple) => (
        <div
          key={ripple.id}
          className={`click-ripple click-ripple-${ripple.color}`}
          style={{ left: ripple.x, top: ripple.y }}
          onAnimationEnd={() => removeClickRipple(ripple.id)}
        />
      ))}

      {/* Tooltip */}
      <MapV2Tooltip ref={tooltipElRef} />
    </div>
  );
}
