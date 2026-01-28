"use client";

import { useEffect, useRef, useCallback } from "react";
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

interface MapContainerProps {
  className?: string;
}

export default function MapContainer({ className = "" }: MapContainerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const popup = useRef<maplibregl.Popup | null>(null);

  const {
    selectedLeaid,
    metricType,
    fiscalYear,
    setSelectedLeaid,
    setHoveredLeaid,
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

      // Add district tiles source
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}?metric=${metricType}&year=${fiscalYear}`],
        minzoom: 3,
        maxzoom: 12,
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
          "fill-opacity": 0.7,
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

  // Handle click events
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current) return;

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
        setSelectedLeaid(null);
      }
    },
    [setSelectedLeaid]
  );

  // Handle hover events
  const handleMouseMove = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !popup.current) return;

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

    return () => {
      map.current?.off("click", handleClick);
      map.current?.off("mousemove", handleMouseMove);
    };
  }, [handleClick, handleMouseMove, setHoveredLeaid]);

  return (
    <div
      ref={mapContainer}
      className={`w-full h-full ${className}`}
      style={{ minHeight: "400px" }}
    />
  );
}
