"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface DistrictLocation {
  leaid: string;
  lat: number | null;
  lng: number | null;
}

interface Props {
  districts: DistrictLocation[];
  onExpand: () => void;
}

const SOURCE_ID = "explore-districts";
const LAYER_ID = "explore-districts-dots";
const MAX_DOTS = 2000;

const STYLE_URL =
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

export default function ExploreMiniMap({ districts, onExpand }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Build GeoJSON from districts
  const buildGeoJSON = useCallback(
    (
      items: DistrictLocation[]
    ): GeoJSON.FeatureCollection<GeoJSON.Point> => ({
      type: "FeatureCollection",
      features: items
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          type: "Feature" as const,
          properties: { leaid: d.leaid },
          geometry: {
            type: "Point" as const,
            coordinates: [d.lng!, d.lat!],
          },
        })),
    }),
    []
  );

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || collapsed) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [-98, 39],
      zoom: 2.5,
      interactive: false,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on("load", () => {
      const geojson =
        districts.length <= MAX_DOTS
          ? buildGeoJSON(districts)
          : { type: "FeatureCollection" as const, features: [] };

      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geojson,
      });

      map.addLayer({
        id: LAYER_ID,
        type: "circle",
        source: SOURCE_ID,
        paint: {
          "circle-radius": 3,
          "circle-color": "#403770",
          "circle-opacity": 0.7,
        },
      });

      // Fit bounds to dots if we have any
      if (geojson.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach((f) => {
          bounds.extend(f.geometry.coordinates as [number, number]);
        });
        map.fitBounds(bounds, { padding: 20, maxZoom: 10, duration: 0 });
      }
    });

    return () => {
      mapRef.current = null;
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

  // Update dots when districts change (after initial load)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const update = () => {
      const source = map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      const geojson =
        districts.length <= MAX_DOTS
          ? buildGeoJSON(districts)
          : { type: "FeatureCollection" as const, features: [] as GeoJSON.Feature<GeoJSON.Point>[] };

      source.setData(geojson);

      // Fit bounds
      if (geojson.features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        geojson.features.forEach((f) => {
          bounds.extend(f.geometry.coordinates as [number, number]);
        });
        map.fitBounds(bounds, { padding: 20, maxZoom: 10, duration: 300 });
      }
    };

    if (map.isStyleLoaded()) {
      update();
    } else {
      map.once("load", update);
    }
  }, [districts, buildGeoJSON]);

  // Collapsed state: just show a small expand button
  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute bottom-4 right-4 z-30 w-10 h-10 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:text-[#403770] transition-colors"
        title="Show mini-map"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="14" height="14" rx="2" />
          <path d="M2 7L7 5L11 7L16 5" />
          <path d="M2 12L7 10L11 12L16 10" />
        </svg>
      </button>
    );
  }

  return (
    <div className="absolute bottom-4 right-4 z-30 w-[280px] h-[200px] bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full" />

      {/* Button overlay */}
      <div className="absolute top-2 right-2 flex gap-1">
        {/* Expand to full map */}
        <button
          onClick={onExpand}
          className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg shadow flex items-center justify-center text-gray-500 hover:text-[#403770] transition-colors"
          title="Show on full map"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 5V1H5" />
            <path d="M13 9V13H9" />
            <path d="M1 1L5.5 5.5" />
            <path d="M13 13L8.5 8.5" />
          </svg>
        </button>

        {/* Minimize */}
        <button
          onClick={() => setCollapsed(true)}
          className="w-7 h-7 bg-white/90 backdrop-blur-sm rounded-lg shadow flex items-center justify-center text-gray-500 hover:text-[#403770] transition-colors"
          title="Minimize map"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M3 7H11" />
          </svg>
        </button>
      </div>
    </div>
  );
}
