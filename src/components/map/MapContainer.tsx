"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapStore } from "@/lib/store";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import MapTooltip from "./MapTooltip";
import ClickRipple from "./ClickRipple";
import TileLoadingIndicator from "./TileLoadingIndicator";
import CustomerOverviewLegend from "./CustomerOverviewLegend";

// Throttle interval for hover handlers (ms) - 20fps is smooth enough for hover effects
const HOVER_THROTTLE_MS = 50;

// US bounds
const US_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-125, 24], // Southwest
  [-66, 50], // Northeast
];

// Panel width constant for viewport calculations
const PANEL_WIDTH = 420;

// State bounding boxes as [sw, ne] for fitBounds - [[west, south], [east, north]]
// These are used to fit the state into view when the panel opens
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


// Category labels for customer shading tooltips
const CUSTOMER_CATEGORY_LABELS: Record<string, string> = {
  multi_year: "Multi-year customer",
  new: "New this year",
  lapsed: "Lapsed customer",
  pipeline: "In pipeline",
  target: "Target",
};

// State name to abbreviation mapping
const STATE_NAME_TO_ABBREV: Record<string, string> = {
  "Alabama": "AL",
  "Alaska": "AK",
  "Arizona": "AZ",
  "Arkansas": "AR",
  "California": "CA",
  "Colorado": "CO",
  "Connecticut": "CT",
  "Delaware": "DE",
  "District of Columbia": "DC",
  "Florida": "FL",
  "Georgia": "GA",
  "Hawaii": "HI",
  "Idaho": "ID",
  "Illinois": "IL",
  "Indiana": "IN",
  "Iowa": "IA",
  "Kansas": "KS",
  "Kentucky": "KY",
  "Louisiana": "LA",
  "Maine": "ME",
  "Maryland": "MD",
  "Massachusetts": "MA",
  "Michigan": "MI",
  "Minnesota": "MN",
  "Mississippi": "MS",
  "Missouri": "MO",
  "Montana": "MT",
  "Nebraska": "NE",
  "Nevada": "NV",
  "New Hampshire": "NH",
  "New Jersey": "NJ",
  "New Mexico": "NM",
  "New York": "NY",
  "North Carolina": "NC",
  "North Dakota": "ND",
  "Ohio": "OH",
  "Oklahoma": "OK",
  "Oregon": "OR",
  "Pennsylvania": "PA",
  "Rhode Island": "RI",
  "South Carolina": "SC",
  "South Dakota": "SD",
  "Tennessee": "TN",
  "Texas": "TX",
  "Utah": "UT",
  "Vermont": "VT",
  "Virginia": "VA",
  "Washington": "WA",
  "West Virginia": "WV",
  "Wisconsin": "WI",
  "Wyoming": "WY",
  "Puerto Rico": "PR",
  "Virgin Islands": "VI",
  "Guam": "GU",
  "American Samoa": "AS",
  "Northern Mariana Islands": "MP",
};

interface MapContainerProps {
  className?: string;
}

export default function MapContainer({ className = "" }: MapContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null);
  const isTouchDevice = useIsTouchDevice();

  // Refs for hover optimization - change detection and throttling
  const lastHoveredLeaidRef = useRef<string | null>(null);
  const lastHoveredStateRef = useRef<string | null>(null);
  const lastHoverTimeRef = useRef(0);

  // Screen reader announcement ref
  const announcementRef = useRef<HTMLDivElement>(null);

  const {
    selectedLeaid,
    setSelectedLeaid,
    hoveredLeaid,
    setHoveredLeaid,
    setStateFilter,
    filters,
    showTooltip,
    hideTooltip,
    updateTooltipPosition,
    addClickRipple,
    touchPreviewLeaid,
    setTouchPreviewLeaid,
    multiSelectMode,
    selectedLeaids,
    toggleDistrictSelection,
    similarDistrictLeaids,
    openStatePanel,
    openDistrictPanel,
    closePanel,
  } = useMapStore();

  // Screen reader announcement helper
  const announce = useCallback((message: string) => {
    if (announcementRef.current) {
      announcementRef.current.textContent = message;
    }
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [
          {
            id: "background",
            type: "background",
            paint: {
              "background-color": "#FFFCFA", // Fullmind off-white
            },
          },
        ],
      },
      center: [-98, 39], // Center of US
      zoom: 4.2, // Slightly zoomed in so customer-shaded districts are visible on load
      minZoom: 2,
      maxZoom: 14,
    });

    // Add navigation controls
    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Wait for style to load
    map.current.on("load", () => {
      if (!map.current) return;

      // Add US states boundaries source (using public GeoJSON)
      map.current.addSource("states", {
        type: "geojson",
        data: "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",
      });

      // Add district tiles source - loads all districts at national level
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}`],
        minzoom: 3.5,
        maxzoom: 12,
      });

      // Add state fill layer (subtle fill for interactivity)
      map.current.addLayer({
        id: "state-fill",
        type: "fill",
        source: "states",
        paint: {
          "fill-color": "transparent",
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.15,
            0.1,
          ],
          "fill-opacity-transition": { duration: 150 },
        },
      });

      // Add state outline layer - prominent on load
      map.current.addLayer({
        id: "state-outline",
        type: "line",
        source: "states",
        paint: {
          "line-color": "#403770", // Plum
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 2,
            6, 2.5,
            10, 1.5,
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 1,
            8, 0.6,
            12, 0.3,
          ],
          "line-opacity-transition": { duration: 150 },
        },
      });

      // Add state hover highlight
      map.current.addLayer({
        id: "state-hover",
        type: "line",
        source: "states",
        filter: ["==", ["get", "name"], ""],
        paint: {
          "line-color": "#F37167", // Coral
          "line-width": 4,
          "line-width-transition": { duration: 100 },
          "line-opacity-transition": { duration: 100 },
        },
      });

      // Customer category fill layer - colors districts by customer status
      // Only shows districts that have a customer_category
      map.current.addLayer({
        id: "district-customer-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["has", "customer_category"],
        paint: {
          "fill-color": [
            "match",
            ["get", "customer_category"],
            "multi_year", "#403770", // Plum
            "new", "#22C55E",        // Green
            "lapsed", "#EF4444",     // Red
            "pipeline", "#F59E0B",   // Amber
            "target", "#6EA3BE",     // Steel Blue
            "#E5E7EB",               // Fallback gray
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.85, // Brighter on hover
            0.6,  // Default opacity
          ],
          "fill-opacity-transition": { duration: 150 },
        },
      });

      // Boundary layer for customer districts - visible at all zoom levels
      // Thinner lines when zoomed out for cleaner national view
      map.current.addLayer({
        id: "district-customer-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["has", "customer_category"],
        paint: {
          "line-color": "#374151",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 0.3,   // Very thin at national level
            5, 0.5,   // Slightly thicker
            7, 1,     // Medium at state level
            10, 1.5,  // Full thickness when zoomed in
          ],
          "line-opacity": 0.8,
          "line-opacity-transition": { duration: 100 },
        },
      });

      // Base fill layer - gray for districts without customer category
      // Only visible when zoomed into a state (zoom >= 6)
      map.current.addLayer({
        id: "district-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        filter: ["!", ["has", "customer_category"]],
        minzoom: 6,
        paint: {
          "fill-color": "#E5E7EB", // Gray
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.7, // Brighter on hover
            0.5, // Default for non-customer districts
          ],
          "fill-opacity-transition": { duration: 150 },
        },
      });

      // Boundary layer for non-customer districts - only when zoomed in
      map.current.addLayer({
        id: "district-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        filter: ["!", ["has", "customer_category"]],
        minzoom: 6,
        paint: {
          "line-color": "#374151",
          "line-width": 1.5,
          "line-opacity": 0.8,
          "line-opacity-transition": { duration: 100 },
        },
      });

      // Hover highlight fill layer (renders under the outline)
      map.current.addLayer({
        id: "district-hover-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": "#F37167", // Coral
          "fill-opacity": 0.4,
          "fill-opacity-transition": { duration: 100 },
        },
        filter: ["==", ["get", "leaid"], ""],
      });

      // Hover highlight outline layer (renders on top of fill)
      map.current.addLayer({
        id: "district-hover",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#F37167", // Coral
          "line-width": 3,
          "line-width-transition": { duration: 100 },
          "line-opacity-transition": { duration: 100 },
        },
        filter: ["==", ["get", "leaid"], ""],
      });

      // Selected district highlight layer
      map.current.addLayer({
        id: "district-selected",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#403770", // Plum
          "line-width": 1.5,
        },
        filter: ["==", ["get", "leaid"], ""],
      });

      // Multi-selected districts fill layer
      map.current.addLayer({
        id: "district-multiselect-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": "#6EA3BE", // Steel Blue
          "fill-opacity": 0.6,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });

      // Multi-selected districts outline layer
      map.current.addLayer({
        id: "district-multiselect-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#6EA3BE", // Steel Blue
          "line-width": 3,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });

      // Similar districts fill layer (for Find Similar feature)
      map.current.addLayer({
        id: "district-similar-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": "#F37167", // Coral
          "fill-opacity": 0.5,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });

      // Similar districts outline layer
      map.current.addLayer({
        id: "district-similar-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#F37167", // Coral
          "line-width": 3,
        },
        filter: ["in", ["get", "leaid"], ["literal", []]],
      });

      setMapReady(true);
      setMapInstance(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update selected district filter
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    map.current.setFilter("district-selected", [
      "==",
      ["get", "leaid"],
      selectedLeaid || "",
    ]);
  }, [selectedLeaid]);

  // Sync hoveredLeaid from store to map layer
  // This enables hover highlights when hovering over the district list (not just the map)
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const filter: maplibregl.FilterSpecification = [
      "==",
      ["get", "leaid"],
      hoveredLeaid || "",
    ];

    // Update both fill and outline layers
    map.current.setFilter("district-hover-fill", filter);
    map.current.setFilter("district-hover", filter);
  }, [hoveredLeaid]);

  // Update multi-selected districts filter
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const leaidArray = Array.from(selectedLeaids);
    const filter: maplibregl.FilterSpecification =
      leaidArray.length > 0
        ? ["in", ["get", "leaid"], ["literal", leaidArray]]
        : ["in", ["get", "leaid"], ["literal", [""]]]; // Empty filter that matches nothing

    map.current.setFilter("district-multiselect-fill", filter);
    map.current.setFilter("district-multiselect-outline", filter);
  }, [selectedLeaids]);

  // Update similar districts filter (for Find Similar feature)
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const filter: maplibregl.FilterSpecification =
      similarDistrictLeaids.length > 0
        ? ["in", ["get", "leaid"], ["literal", similarDistrictLeaids]]
        : ["in", ["get", "leaid"], ["literal", [""]]];

    if (map.current.getLayer("district-similar-fill")) {
      map.current.setFilter("district-similar-fill", filter);
    }
    if (map.current.getLayer("district-similar-outline")) {
      map.current.setFilter("district-similar-outline", filter);
    }
  }, [similarDistrictLeaids]);

  // Update tile source when selected state changes - filter to state or show all
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const source = map.current.getSource("districts") as maplibregl.VectorTileSource;
    if (source && "setTiles" in source) {
      // When a state is selected, filter to that state for better performance
      // Otherwise, load all districts to show customer shading at national level
      const stateParam = selectedState ? `?state=${selectedState}` : "";
      (source as unknown as { setTiles: (tiles: string[]) => void }).setTiles([
        `${window.location.origin}/api/tiles/{z}/{x}/{y}${stateParam}`,
      ]);
    }
  }, [selectedState]);

  // Handle click events - state level at low zoom, district level at high zoom
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;

      const zoom = map.current.getZoom();

      // Add click ripple effect
      const color = zoom < 6 ? "plum" : "coral";
      addClickRipple(e.originalEvent.clientX, e.originalEvent.clientY, color);

      // At low zoom, check for state clicks first
      if (zoom < 6 && map.current.getLayer("state-fill")) {
        const stateFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: ["state-fill"],
        });

        if (stateFeatures.length > 0) {
          const feature = stateFeatures[0];
          // Try to extract state code from the feature name
          const stateName = feature.properties?.name;
          const stateCode = stateName ? STATE_NAME_TO_ABBREV[stateName] : null;

          if (stateCode && STATE_BBOX[stateCode]) {
            const bbox = STATE_BBOX[stateCode];
            setSelectedState(stateCode);
            setStateFilter(stateCode);
            hideTooltip();
            announce(`Exploring ${stateName}`);

            // Open state panel when clicking state at low zoom
            openStatePanel(stateCode);

            // Fit state to view with padding to account for the side panel
            // The right padding ensures the state is centered in the visible area left of the panel
            map.current.fitBounds(bbox, {
              padding: {
                top: 60,
                bottom: 40,
                left: 40,
                right: PANEL_WIDTH + 40, // Panel width + breathing room
              },
              maxZoom: 8, // Prevent over-zooming on small states
              duration: 800,
            });
            return;
          }
        }
      }

      // Check for district clicks (both customer-filled and regular districts)
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["district-customer-fill", "district-fill"],
      });

      if (features.length > 0) {
        const feature = features[0];
        const leaid = feature.properties?.leaid;
        const name = feature.properties?.name;

        if (leaid) {
          // Multi-select mode: toggle selection
          if (multiSelectMode) {
            toggleDistrictSelection(leaid);
            const isNowSelected = !selectedLeaids.has(leaid);
            announce(isNowSelected ? `Added ${name} to selection` : `Removed ${name} from selection`);
            return;
          }

          // Touch device: tap-to-preview pattern
          if (isTouchDevice && touchPreviewLeaid !== leaid) {
            setTouchPreviewLeaid(leaid);
            // Show tooltip on first tap
            const stateAbbrev = feature.properties?.state_abbrev;
            const enrollment = feature.properties?.enrollment;
            const salesExec = feature.properties?.sales_executive;

            showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
              type: "district",
              leaid,
              name,
              stateAbbrev,
              enrollment: enrollment ? Number(enrollment) : undefined,
              salesExecutive: salesExec || null,
            });
            announce(`${name}, ${stateAbbrev}. Tap again to select.`);
            return;
          }

          // Select on second tap or mouse click
          openDistrictPanel(leaid);
          setTouchPreviewLeaid(null);
          hideTooltip();
          announce(`Selected ${name}`);

          // Ensure district is visible (not hidden behind panel)
          // Get the click point and check if it would be behind the panel
          const containerWidth = containerRef.current?.clientWidth || window.innerWidth;
          const visibleAreaRight = containerWidth - PANEL_WIDTH;

          // If the click was in the area that will be covered by the panel, pan left
          if (e.originalEvent.clientX > visibleAreaRight - 40) {
            // Pan the map so the district is centered in the visible area
            const currentCenter = map.current.getCenter();

            // Calculate how much we need to pan (convert panel width to lng offset at current zoom)
            // Use unproject to get accurate offset based on current zoom level
            const centerPoint = map.current.project(currentCenter);
            const offsetPoint: [number, number] = [centerPoint.x - (PANEL_WIDTH / 2 + 40), centerPoint.y];
            const newCenter = map.current.unproject(offsetPoint);

            map.current.panTo(newCenter, {
              duration: 300,
            });
          }
        }
      } else {
        // Clicking outside - clear preview and selection
        setTouchPreviewLeaid(null);
        hideTooltip();

        // If zoomed in, zoom back out
        if (zoom > 5 && selectedState) {
          map.current.flyTo({
            center: [-98, 39],
            zoom: 4.2,
            duration: 1000,
            essential: true,
          });
          setSelectedState(null);
          setStateFilter(null);
          announce("Returned to US map view");
        }
        setSelectedLeaid(null);
      }
    },
    [
      setSelectedLeaid,
      setStateFilter,
      selectedState,
      addClickRipple,
      hideTooltip,
      showTooltip,
      isTouchDevice,
      touchPreviewLeaid,
      setTouchPreviewLeaid,
      announce,
      multiSelectMode,
      selectedLeaids,
      toggleDistrictSelection,
      openStatePanel,
      openDistrictPanel,
    ]
  );

  // Handle state hover events (layer-specific, with throttling and change detection)
  const handleStateHover = useCallback(
    (e: maplibregl.MapLayerMouseEvent) => {
      if (!map.current || isTouchDevice) return;

      // Throttle: skip if called too recently
      const now = Date.now();
      if (now - lastHoverTimeRef.current < HOVER_THROTTLE_MS) return;
      lastHoverTimeRef.current = now;

      // Only handle state hover at low zoom
      const zoom = map.current.getZoom();
      if (zoom >= 6) return;

      const feature = e.features?.[0];
      if (!feature) return;

      const stateName = feature.properties?.name as string | undefined;
      const stateCode = stateName ? STATE_NAME_TO_ABBREV[stateName] : null;

      // Change detection: skip if same state
      if (stateName === lastHoveredStateRef.current) {
        // Still update tooltip position for smooth tracking
        updateTooltipPosition(e.originalEvent.clientX, e.originalEvent.clientY);
        return;
      }
      lastHoveredStateRef.current = stateName || null;

      // Clear any district hover state
      if (lastHoveredLeaidRef.current !== null) {
        lastHoveredLeaidRef.current = null;
        map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
        map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
        setHoveredLeaid(null);
      }

      // Update cursor
      map.current.getCanvas().style.cursor = "pointer";

      // Update state hover highlight
      map.current.setFilter("state-hover", [
        "==",
        ["get", "name"],
        stateName || "",
      ]);

      // Show React tooltip
      showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
        type: "state",
        stateName: stateName || undefined,
        stateCode: stateCode || undefined,
      });
    },
    [setHoveredLeaid, showTooltip, updateTooltipPosition, isTouchDevice]
  );

  // Handle district hover events (layer-specific, with throttling and change detection)
  const handleDistrictHover = useCallback(
    (e: maplibregl.MapLayerMouseEvent) => {
      if (!map.current || isTouchDevice) return;

      // Throttle: skip if called too recently
      const now = Date.now();
      if (now - lastHoverTimeRef.current < HOVER_THROTTLE_MS) return;
      lastHoverTimeRef.current = now;

      const feature = e.features?.[0];
      if (!feature) return;

      const leaid = feature.properties?.leaid as string | undefined;

      // Change detection: skip if same district
      if (leaid === lastHoveredLeaidRef.current) {
        // Still update tooltip position for smooth tracking
        updateTooltipPosition(e.originalEvent.clientX, e.originalEvent.clientY);
        return;
      }
      lastHoveredLeaidRef.current = leaid || null;

      // Clear any state hover state
      if (lastHoveredStateRef.current !== null) {
        lastHoveredStateRef.current = null;
        if (map.current.getLayer("state-hover")) {
          map.current.setFilter("state-hover", ["==", ["get", "name"], ""]);
        }
      }

      const name = feature.properties?.name;
      const stateAbbrev = feature.properties?.state_abbrev;
      const enrollment = feature.properties?.enrollment;
      const salesExec = feature.properties?.sales_executive;
      const customerCategory = feature.properties?.customer_category;

      // Build display name with customer category if present
      const categoryLabel = customerCategory ? CUSTOMER_CATEGORY_LABELS[customerCategory] : null;
      const displayName = categoryLabel ? `${name} - ${categoryLabel}` : name;

      // Update cursor
      map.current.getCanvas().style.cursor = "pointer";

      // Update hover filter (both fill and outline)
      const hoverFilter: maplibregl.FilterSpecification = [
        "==",
        ["get", "leaid"],
        leaid || "",
      ];
      map.current.setFilter("district-hover-fill", hoverFilter);
      map.current.setFilter("district-hover", hoverFilter);

      // Update store
      setHoveredLeaid(leaid || null);

      // Show React tooltip
      showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
        type: "district",
        leaid,
        name: displayName,
        stateAbbrev,
        enrollment: enrollment ? Number(enrollment) : undefined,
        salesExecutive: salesExec || null,
      });
    },
    [setHoveredLeaid, showTooltip, updateTooltipPosition, isTouchDevice]
  );

  // Handle mouse leave for districts
  const handleDistrictMouseLeave = useCallback(() => {
    if (!map.current) return;
    lastHoveredLeaidRef.current = null;
    map.current.getCanvas().style.cursor = "";
    // Clear both fill and outline hover layers
    map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
    setHoveredLeaid(null);
    hideTooltip();
  }, [setHoveredLeaid, hideTooltip]);

  // Handle mouse leave for states
  const handleStateMouseLeave = useCallback(() => {
    if (!map.current) return;
    lastHoveredStateRef.current = null;
    if (map.current.getLayer("state-hover")) {
      map.current.setFilter("state-hover", ["==", ["get", "name"], ""]);
    }
    hideTooltip();
  }, [hideTooltip]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Clear panel and selection, then zoom out if needed
        closePanel();
        setTouchPreviewLeaid(null);
        hideTooltip();

        if (selectedState && map.current) {
          map.current.flyTo({
            center: [-98, 39],
            zoom: 4.2,
            duration: 1000,
            essential: true,
          });
          setSelectedState(null);
          setStateFilter(null);
          announce("Returned to US map view");
        } else {
          announce("Panel closed");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedState,
    setStateFilter,
    setTouchPreviewLeaid,
    hideTooltip,
    announce,
    closePanel,
  ]);

  // Attach event listeners using layer-specific events for better performance
  useEffect(() => {
    if (!map.current) return;

    map.current.on("click", handleClick);

    // Use layer-specific mousemove events instead of map-level event
    // These only fire when cursor is over the specific layer
    // Listen on both customer-fill and regular fill layers
    map.current.on("mousemove", "district-customer-fill", handleDistrictHover);
    map.current.on("mouseleave", "district-customer-fill", handleDistrictMouseLeave);
    map.current.on("mousemove", "district-fill", handleDistrictHover);
    map.current.on("mouseleave", "district-fill", handleDistrictMouseLeave);

    // Only add state event listeners once the layer exists
    const addStateListeners = () => {
      if (map.current?.getLayer("state-fill")) {
        map.current.on("mousemove", "state-fill", handleStateHover);
        map.current.on("mouseleave", "state-fill", handleStateMouseLeave);
      }
    };

    // Check if layer already exists, otherwise wait for sourcedata event
    if (map.current.getLayer("state-fill")) {
      addStateListeners();
    } else {
      const handleSourceData = (e: maplibregl.MapSourceDataEvent) => {
        if (e.sourceId === "states" && map.current?.getLayer("state-fill")) {
          addStateListeners();
          map.current?.off("sourcedata", handleSourceData);
        }
      };
      map.current.on("sourcedata", handleSourceData);
    }

    return () => {
      map.current?.off("click", handleClick);
      map.current?.off("mousemove", "district-customer-fill", handleDistrictHover);
      map.current?.off("mouseleave", "district-customer-fill", handleDistrictMouseLeave);
      map.current?.off("mousemove", "district-fill", handleDistrictHover);
      map.current?.off("mouseleave", "district-fill", handleDistrictMouseLeave);
      map.current?.off("mousemove", "state-fill", handleStateHover);
      map.current?.off("mouseleave", "state-fill", handleStateMouseLeave);
    };
  }, [handleClick, handleDistrictHover, handleDistrictMouseLeave, handleStateHover, handleStateMouseLeave]);

  // Handle zoom back to US view
  const handleBackToUS = useCallback(() => {
    if (!map.current) return;

    map.current.flyTo({
      center: [-98, 39],
      zoom: 4.2,
      duration: 1000,
      essential: true,
    });
    setSelectedState(null);
    setStateFilter(null);
    setSelectedLeaid(null);
    announce("Returned to US map view");
  }, [setStateFilter, setSelectedLeaid, announce]);

  // Sync selected state with store filter (from dropdown selection)
  useEffect(() => {
    if (filters.stateAbbrev && filters.stateAbbrev !== selectedState && mapReady) {
      const stateCode = filters.stateAbbrev;
      if (STATE_BBOX[stateCode] && map.current) {
        const bbox = STATE_BBOX[stateCode];
        setSelectedState(stateCode);
        // Use fitBounds for consistent behavior, but without panel padding
        // since the panel doesn't auto-open from dropdown selection
        map.current.fitBounds(bbox, {
          padding: { top: 60, bottom: 40, left: 40, right: 40 },
          maxZoom: 8,
          duration: 800,
        });
      }
    } else if (!filters.stateAbbrev && selectedState && mapReady) {
      setSelectedState(null);
    }
  }, [filters.stateAbbrev, selectedState, mapReady]);

  return (
    <>
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <div
        ref={containerRef}
        className={`overflow-hidden ${className}`}
      >
        {/* Map container with focus ring for accessibility */}
        <div
          ref={mapContainer}
          className="w-full h-full map-focus-ring"
          tabIndex={0}
          role="application"
          aria-label="Interactive territory map. Use mouse or touch to explore states and districts. Press Escape to zoom out."
        />

        {/* Screen reader announcements */}
        <div
          ref={announcementRef}
          className="aria-live-region"
          aria-live="polite"
          aria-atomic="true"
        />

        {/* React tooltip component */}
        <MapTooltip containerRef={containerRef} />

        {/* Click ripple effect */}
        <ClickRipple containerRef={containerRef} />

        {/* Tile loading indicator */}
        <TileLoadingIndicator map={mapInstance} />

        {/* Back to US button when zoomed into a state */}
        {selectedState && (
          <button
            onClick={handleBackToUS}
            className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-[#403770]"
            aria-label="Go back to US map view"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to US
          </button>
        )}

        {/* Customer overview legend (polygon shading categories) */}
        {mapReady && (
          <CustomerOverviewLegend className="absolute bottom-4 left-4 z-10" />
        )}
      </div>
    </>
  );
}
