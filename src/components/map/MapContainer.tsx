"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapStore } from "@/lib/store";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import MapTooltip from "./MapTooltip";
import ClickRipple from "./ClickRipple";
import TileLoadingIndicator from "./TileLoadingIndicator";

// Throttle interval for hover handlers (ms) - 20fps is smooth enough for hover effects
const HOVER_THROTTLE_MS = 50;

// US bounds
const US_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-125, 24], // Southwest
  [-66, 50], // Northeast
];

// State bounding boxes for zoom (approximate centers and zoom levels)
const STATE_BOUNDS: Record<string, { center: [number, number]; zoom: number }> = {
  AL: { center: [-86.9, 32.8], zoom: 6.5 },
  AK: { center: [-153, 64], zoom: 3.5 },
  AZ: { center: [-111.9, 34.2], zoom: 6 },
  AR: { center: [-92.4, 34.9], zoom: 6.5 },
  CA: { center: [-119.5, 37.2], zoom: 5.5 },
  CO: { center: [-105.5, 39], zoom: 6 },
  CT: { center: [-72.7, 41.6], zoom: 8 },
  DE: { center: [-75.5, 39], zoom: 8 },
  DC: { center: [-77, 38.9], zoom: 11 },
  FL: { center: [-82, 28.5], zoom: 6 },
  GA: { center: [-83.5, 32.7], zoom: 6.5 },
  HI: { center: [-157, 20.5], zoom: 6 },
  ID: { center: [-114.5, 44.4], zoom: 5.5 },
  IL: { center: [-89.2, 40], zoom: 6 },
  IN: { center: [-86.2, 39.9], zoom: 6.5 },
  IA: { center: [-93.5, 42], zoom: 6.5 },
  KS: { center: [-98.5, 38.5], zoom: 6.5 },
  KY: { center: [-85.7, 37.8], zoom: 6.5 },
  LA: { center: [-92, 31], zoom: 6.5 },
  ME: { center: [-69, 45.4], zoom: 6.5 },
  MD: { center: [-76.8, 39.2], zoom: 7 },
  MA: { center: [-71.8, 42.2], zoom: 7.5 },
  MI: { center: [-85, 44.3], zoom: 6 },
  MN: { center: [-94.5, 46.3], zoom: 6 },
  MS: { center: [-89.7, 32.7], zoom: 6.5 },
  MO: { center: [-92.5, 38.4], zoom: 6 },
  MT: { center: [-109.6, 47], zoom: 5.5 },
  NE: { center: [-99.8, 41.5], zoom: 6 },
  NV: { center: [-116.6, 39], zoom: 5.5 },
  NH: { center: [-71.5, 43.7], zoom: 7 },
  NJ: { center: [-74.7, 40.2], zoom: 7.5 },
  NM: { center: [-106, 34.5], zoom: 6 },
  NY: { center: [-75.5, 42.9], zoom: 6 },
  NC: { center: [-79.4, 35.5], zoom: 6.5 },
  ND: { center: [-100.5, 47.4], zoom: 6 },
  OH: { center: [-82.8, 40.3], zoom: 6.5 },
  OK: { center: [-97.5, 35.5], zoom: 6.5 },
  OR: { center: [-120.5, 44], zoom: 6 },
  PA: { center: [-77.5, 41], zoom: 6.5 },
  RI: { center: [-71.5, 41.6], zoom: 9 },
  SC: { center: [-80.9, 33.9], zoom: 7 },
  SD: { center: [-100.2, 44.4], zoom: 6 },
  TN: { center: [-86.3, 35.8], zoom: 6.5 },
  TX: { center: [-99.5, 31.5], zoom: 5.5 },
  UT: { center: [-111.7, 39.3], zoom: 6 },
  VT: { center: [-72.7, 44], zoom: 7 },
  VA: { center: [-78.8, 37.5], zoom: 6.5 },
  WA: { center: [-120.5, 47.4], zoom: 6 },
  WV: { center: [-80.6, 38.9], zoom: 7 },
  WI: { center: [-89.8, 44.6], zoom: 6 },
  WY: { center: [-107.5, 43], zoom: 6 },
  PR: { center: [-66.5, 18.2], zoom: 8 },
  VI: { center: [-64.8, 18.3], zoom: 10 },
  GU: { center: [144.8, 13.5], zoom: 10 },
  AS: { center: [-170.7, -14.3], zoom: 10 },
  MP: { center: [145.7, 15.2], zoom: 8 },
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
      zoom: 4,
      minZoom: 3,
      maxZoom: 14,
      maxBounds: US_BOUNDS,
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

      // Add district tiles source (starts empty, populated when state is selected)
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?state=_none_`],
        minzoom: 3,
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

      // Fill layer - Deep Coral for districts with revenue, gray for others
      // Note: MVT encodes booleans as 1/0, so we check explicitly
      map.current.addLayer({
        id: "district-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": [
            "case",
            ["any",
              ["==", ["get", "has_revenue"], true],
              ["==", ["get", "has_revenue"], 1],
            ],
            "#F37167", // Deep Coral - Fullmind brand color for districts with revenue
            "#E5E7EB", // Gray for districts without revenue
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["feature-state", "hover"], false],
            0.85, // Brighter on hover
            [
              "case",
              ["any",
                ["==", ["get", "has_revenue"], true],
                ["==", ["get", "has_revenue"], 1],
              ],
              0.7, // More visible for revenue districts
              0.5, // Visible for non-revenue districts
            ],
          ],
          "fill-opacity-transition": { duration: 150 },
        },
      });

      // Boundary layer - visible lines
      map.current.addLayer({
        id: "district-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#374151",
          "line-width": 1.5,
          "line-opacity": 0.8,
          "line-opacity-transition": { duration: 100 },
        },
      });

      // Hover highlight layer
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

  // Update tile source when selected state changes - only load districts for focused state
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const source = map.current.getSource("districts") as maplibregl.VectorTileSource;
    if (source && "setTiles" in source) {
      const stateParam = selectedState ? `?state=${selectedState}` : "?state=_none_";
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

          if (stateCode && STATE_BOUNDS[stateCode]) {
            const bounds = STATE_BOUNDS[stateCode];
            setSelectedState(stateCode);
            setStateFilter(stateCode);
            hideTooltip();
            announce(`Exploring ${stateName}`);

            map.current.flyTo({
              center: bounds.center,
              zoom: bounds.zoom,
              duration: 1000,
              essential: true,
            });
            return;
          }
        }
      }

      // Check for district clicks
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["district-fill"],
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
            const hasRevenue = feature.properties?.has_revenue === true || feature.properties?.has_revenue === 1;
            const hasPipeline = feature.properties?.has_pipeline === true || feature.properties?.has_pipeline === 1;
            const enrollment = feature.properties?.enrollment;
            const salesExec = feature.properties?.sales_executive;

            showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
              type: "district",
              leaid,
              name,
              stateAbbrev,
              hasRevenue,
              hasPipeline,
              enrollment: enrollment ? Number(enrollment) : undefined,
              salesExecutive: salesExec || null,
            });
            announce(`${name}, ${stateAbbrev}. Tap again to select.`);
            return;
          }

          // Select on second tap or mouse click
          setSelectedLeaid(leaid);
          setTouchPreviewLeaid(null);
          hideTooltip();
          announce(`Selected ${name}`);
        }
      } else {
        // Clicking outside - clear preview and selection
        setTouchPreviewLeaid(null);
        hideTooltip();

        // If zoomed in, zoom back out
        if (zoom > 5 && selectedState) {
          map.current.flyTo({
            center: [-98, 39],
            zoom: 4,
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
      const hasRevenue = feature.properties?.has_revenue === true || feature.properties?.has_revenue === 1;
      const hasPipeline = feature.properties?.has_pipeline === true || feature.properties?.has_pipeline === 1;
      const enrollment = feature.properties?.enrollment;
      const salesExec = feature.properties?.sales_executive;

      // Update cursor
      map.current.getCanvas().style.cursor = "pointer";

      // Update hover filter
      map.current.setFilter("district-hover", [
        "==",
        ["get", "leaid"],
        leaid || "",
      ]);

      // Update store
      setHoveredLeaid(leaid || null);

      // Show React tooltip
      showTooltip(e.originalEvent.clientX, e.originalEvent.clientY, {
        type: "district",
        leaid,
        name,
        stateAbbrev,
        hasRevenue,
        hasPipeline,
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
        // Clear selection and zoom out if needed
        if (selectedLeaid) {
          setSelectedLeaid(null);
          announce("Selection cleared");
        } else if (selectedState && map.current) {
          map.current.flyTo({
            center: [-98, 39],
            zoom: 4,
            duration: 1000,
            essential: true,
          });
          setSelectedState(null);
          setStateFilter(null);
          announce("Returned to US map view");
        }
        // Clear touch preview
        setTouchPreviewLeaid(null);
        hideTooltip();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedLeaid,
    selectedState,
    setSelectedLeaid,
    setStateFilter,
    setTouchPreviewLeaid,
    hideTooltip,
    announce,
  ]);

  // Attach event listeners using layer-specific events for better performance
  useEffect(() => {
    if (!map.current) return;

    map.current.on("click", handleClick);

    // Use layer-specific mousemove events instead of map-level event
    // These only fire when cursor is over the specific layer
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
      zoom: 4,
      duration: 1000,
      essential: true,
    });
    setSelectedState(null);
    setStateFilter(null);
    setSelectedLeaid(null);
    announce("Returned to US map view");
  }, [setStateFilter, setSelectedLeaid, announce]);

  // Sync selected state with store filter
  useEffect(() => {
    if (filters.stateAbbrev && filters.stateAbbrev !== selectedState && mapReady) {
      const stateCode = filters.stateAbbrev;
      if (STATE_BOUNDS[stateCode] && map.current) {
        const bounds = STATE_BOUNDS[stateCode];
        setSelectedState(stateCode);
        map.current.flyTo({
          center: bounds.center,
          zoom: bounds.zoom,
          duration: 1000,
          essential: true,
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
        className={`relative w-full h-full ${className}`}
        style={{ minHeight: "400px" }}
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

        {/* Interactive hint when at US level */}
        {!selectedState && mapReady && (
          <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-white/90 backdrop-blur-sm rounded-lg shadow-md text-xs text-gray-600 pointer-events-none">
            {isTouchDevice ? "Tap a state to explore districts" : "Click a state to explore districts"}
          </div>
        )}
      </div>
    </>
  );
}
