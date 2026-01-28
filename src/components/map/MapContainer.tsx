"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapStore } from "@/lib/store";
import { useQuantiles } from "@/lib/api";

// Status outline colors (Fullmind brand)
const STATUS_OUTLINES = {
  customer: "#F37167", // Deep Coral
  pipeline: "#6EA3BE", // Steel Blue
  customer_pipeline: "#403770", // Plum (thicker line)
  no_data: "transparent",
};

// Choropleth color ramp
const CHOROPLETH_COLORS = [
  "#f7fbff",
  "#c6dbef",
  "#6baed6",
  "#2171b5",
  "#084594",
];

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
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);
  const [selectedState, setSelectedState] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const {
    selectedLeaid,
    metricType,
    fiscalYear,
    setSelectedLeaid,
    setHoveredLeaid,
    setStateFilter,
    filters,
  } = useMapStore();

  const { data: quantiles } = useQuantiles(metricType, fiscalYear);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          // OpenStreetMap tiles for basemap
          osm: {
            type: "raster",
            tiles: [
              "https://a.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://b.tile.openstreetmap.org/{z}/{x}/{y}.png",
              "https://c.tile.openstreetmap.org/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "osm-tiles",
            type: "raster",
            source: "osm",
            minzoom: 0,
            maxzoom: 19,
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

      // Add district tiles source
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?metric=${metricType}&year=${fiscalYear}`],
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
          "fill-opacity": 0.1,
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
        },
      });

      // Add choropleth fill layer
      map.current.addLayer({
        id: "district-fill",
        type: "fill",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "fill-color": [
            "case",
            ["==", ["get", "metric_value"], 0],
            "transparent",
            // Default color - will be updated with quantiles
            CHOROPLETH_COLORS[0],
          ],
          "fill-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 0.4,
            6, 0.7,
            10, 0.8,
          ],
        },
      });

      // Add district boundary layer - visible but subtle, becomes clearer on zoom
      map.current.addLayer({
        id: "district-boundary",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#666666",
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 0.2,
            6, 0.5,
            8, 0.8,
            12, 1.2,
          ],
          "line-opacity": [
            "interpolate",
            ["linear"],
            ["zoom"],
            3, 0.2,
            6, 0.4,
            8, 0.6,
            12, 0.8,
          ],
        },
      });

      // Add status outline layer
      map.current.addLayer({
        id: "district-outline",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": [
            "match",
            ["get", "status"],
            "customer",
            STATUS_OUTLINES.customer,
            "pipeline",
            STATUS_OUTLINES.pipeline,
            "customer_pipeline",
            STATUS_OUTLINES.customer_pipeline,
            "transparent",
          ],
          "line-width": [
            "match",
            ["get", "status"],
            "customer_pipeline",
            3,
            "customer",
            2,
            "pipeline",
            2,
            0,
          ],
        },
      });

      // Add selected district highlight layer
      map.current.addLayer({
        id: "district-selected",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#403770", // Plum
          "line-width": 4,
        },
        filter: ["==", ["get", "leaid"], ""],
      });

      // Add hover highlight layer
      map.current.addLayer({
        id: "district-hover",
        type: "line",
        source: "districts",
        "source-layer": "districts",
        paint: {
          "line-color": "#F37167", // Coral
          "line-width": 2,
          "line-dasharray": [2, 2],
        },
        filter: ["==", ["get", "leaid"], ""],
      });

      setMapReady(true);
    });

    // Create popup
    popup.current = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
    });

    return () => {
      popup.current?.remove();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update tile source when metric/year changes
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    const source = map.current.getSource("districts") as maplibregl.VectorTileSource;
    if (source && 'setTiles' in source) {
      (source as unknown as { setTiles: (tiles: string[]) => void }).setTiles([
        `${window.location.origin}/api/tiles/{z}/{x}/{y}?metric=${metricType}&year=${fiscalYear}`,
      ]);
    }
  }, [metricType, fiscalYear]);

  // Update choropleth colors when quantiles change
  useEffect(() => {
    if (!map.current?.isStyleLoaded() || !quantiles) return;

    const breaks = quantiles.breaks;
    const colors = quantiles.colors;

    // Build step expression for choropleth
    // Format: ["step", ["get", "metric_value"], color0, break1, color1, break2, color2, ...]
    const colorExpression: maplibregl.ExpressionSpecification = [
      "case",
      ["==", ["get", "metric_value"], 0],
      "transparent",
      [
        "step",
        ["get", "metric_value"],
        colors[0],
        breaks[1] || 1,
        colors[1],
        breaks[2] || 10,
        colors[2],
        breaks[3] || 100,
        colors[3],
        breaks[4] || 1000,
        colors[4],
      ],
    ];

    map.current.setPaintProperty("district-fill", "fill-color", colorExpression);
  }, [quantiles]);

  // Update selected district filter
  useEffect(() => {
    if (!map.current?.isStyleLoaded()) return;

    map.current.setFilter("district-selected", [
      "==",
      ["get", "leaid"],
      selectedLeaid || "",
    ]);
  }, [selectedLeaid]);

  // Handle click events - state level at low zoom, district level at high zoom
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;

      const zoom = map.current.getZoom();

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
        if (leaid) {
          setSelectedLeaid(leaid);
        }
      } else {
        // Clicking outside - if zoomed in, zoom back out
        if (zoom > 5 && selectedState) {
          map.current.flyTo({
            center: [-98, 39],
            zoom: 4,
            duration: 1000,
            essential: true,
          });
          setSelectedState(null);
          setStateFilter(null);
        }
        setSelectedLeaid(null);
      }
    },
    [setSelectedLeaid, setStateFilter, selectedState]
  );

  // Handle hover events
  const handleMouseMove = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !popup.current) return;

      const zoom = map.current.getZoom();

      // At low zoom, handle state hover
      if (zoom < 6 && map.current.getLayer("state-fill")) {
        const stateFeatures = map.current.queryRenderedFeatures(e.point, {
          layers: ["state-fill"],
        });

        if (stateFeatures.length > 0) {
          const feature = stateFeatures[0];
          const stateName = feature.properties?.name;
          const stateCode = stateName ? STATE_NAME_TO_ABBREV[stateName] : null;

          // Update cursor
          map.current.getCanvas().style.cursor = "pointer";

          // Update state hover highlight
          map.current.setFilter("state-hover", [
            "==",
            ["get", "name"],
            stateName || "",
          ]);

          // Clear district hover
          map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
          setHoveredLeaid(null);

          // Show state popup
          popup.current
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="text-sm">
                <div class="font-bold text-[#403770]">${stateName || stateCode}</div>
                <div class="text-gray-500 text-xs mt-1">Click to explore districts</div>
              </div>`
            )
            .addTo(map.current);
          return;
        }
      }

      // Clear state hover at higher zoom
      if (map.current.getLayer("state-hover")) {
        map.current.setFilter("state-hover", [
          "==",
          ["get", "name"],
          "",
        ]);
      }

      // Handle district hover
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: ["district-fill"],
      });

      if (features.length > 0) {
        const feature = features[0];
        const leaid = feature.properties?.leaid;
        const name = feature.properties?.name;
        const stateAbbrev = feature.properties?.state_abbrev;
        const metricValue = feature.properties?.metric_value || 0;
        const status = feature.properties?.status;

        // Update cursor
        map.current.getCanvas().style.cursor = "pointer";

        // Update hover filter
        map.current.setFilter("district-hover", [
          "==",
          ["get", "leaid"],
          leaid || "",
        ]);

        // Update store
        setHoveredLeaid(leaid);

        // Format metric value
        const formattedValue =
          metricValue > 0
            ? new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(metricValue)
            : "$0";

        // Build status badges
        let statusBadge = "";
        if (status === "customer_pipeline") {
          statusBadge = '<span class="inline-block px-2 py-0.5 text-xs rounded bg-[#403770] text-white mr-1">Customer + Pipeline</span>';
        } else if (status === "customer") {
          statusBadge = '<span class="inline-block px-2 py-0.5 text-xs rounded bg-[#F37167] text-white mr-1">Customer</span>';
        } else if (status === "pipeline") {
          statusBadge = '<span class="inline-block px-2 py-0.5 text-xs rounded bg-[#6EA3BE] text-white mr-1">Pipeline</span>';
        }

        // Show popup
        popup.current
          .setLngLat(e.lngLat)
          .setHTML(
            `<div class="text-sm">
              <div class="font-bold text-[#403770]">${name}</div>
              <div class="text-gray-600">${stateAbbrev}</div>
              <div class="mt-1">${statusBadge}</div>
              <div class="mt-1 font-medium">${formattedValue}</div>
            </div>`
          )
          .addTo(map.current);
      } else {
        map.current.getCanvas().style.cursor = "";
        map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
        setHoveredLeaid(null);
        popup.current.remove();
      }
    },
    [setHoveredLeaid]
  );

  // Attach event listeners
  useEffect(() => {
    if (!map.current) return;

    map.current.on("click", handleClick);
    map.current.on("mousemove", handleMouseMove);
    map.current.on("mouseleave", "district-fill", () => {
      if (!map.current || !popup.current) return;
      map.current.getCanvas().style.cursor = "";
      map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
      setHoveredLeaid(null);
      popup.current.remove();
    });
    // Only add state mouseleave listener once the layer exists
    const addStateMouseLeave = () => {
      if (map.current?.getLayer("state-fill")) {
        map.current.on("mouseleave", "state-fill", () => {
          if (!map.current || !popup.current) return;
          if (map.current.getLayer("state-hover")) {
            map.current.setFilter("state-hover", [
              "==",
              ["get", "name"],
              "",
            ]);
          }
          popup.current.remove();
        });
      }
    };

    // Check if layer already exists, otherwise wait for sourcedata event
    if (map.current.getLayer("state-fill")) {
      addStateMouseLeave();
    } else {
      map.current.on("sourcedata", (e) => {
        if (e.sourceId === "states" && map.current?.getLayer("state-fill")) {
          addStateMouseLeave();
        }
      });
    }

    return () => {
      map.current?.off("click", handleClick);
      map.current?.off("mousemove", handleMouseMove);
    };
  }, [handleClick, handleMouseMove, setHoveredLeaid]);

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
  }, [setStateFilter, setSelectedLeaid]);

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
    <div className={`relative w-full h-full ${className}`} style={{ minHeight: "400px" }}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Back to US button when zoomed into a state */}
      {selectedState && (
        <button
          onClick={handleBackToUS}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-colors text-sm font-medium text-[#403770]"
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
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to US
        </button>
      )}

      {/* Interactive hint when at US level */}
      {!selectedState && mapReady && (
        <div className="absolute bottom-4 left-4 z-10 px-3 py-2 bg-white/90 rounded-lg shadow-md text-xs text-gray-600 pointer-events-none">
          Click a state to explore districts
        </div>
      )}
    </div>
  );
}
