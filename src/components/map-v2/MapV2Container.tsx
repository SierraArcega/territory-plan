"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useMapV2Store } from "@/lib/map-v2-store";
import { VENDOR_CONFIGS, VENDOR_IDS, buildFilterExpression } from "@/lib/map-v2-layers";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";
import { useProfile } from "@/lib/api";
import MapV2Tooltip from "./MapV2Tooltip";

// Throttle interval for hover handlers
const HOVER_THROTTLE_MS = 50;

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

export default function MapV2Container() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const homeMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const isTouchDevice = useIsTouchDevice();
  const { data: profile } = useProfile();

  // Refs for hover optimization
  const lastHoveredLeaidRef = useRef<string | null>(null);
  const lastHoverTimeRef = useRef(0);

  const {
    selectedLeaid,
    hoveredLeaid,
    activeVendors,
    filterOwner,
    filterPlanId,
    panelState,
    selectDistrict,
    selectState,
    setHoveredLeaid,
    showTooltip,
    hideTooltip,
    updateTooltipPosition,
    addClickRipple,
    addDistrictToPlan,
    toggleDistrictSelection,
  } = useMapV2Store();

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

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      if (!map.current) return;

      // Add state boundaries source
      map.current.addSource("states", {
        type: "geojson",
        data: "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json",
      });

      // Add district tiles source
      map.current.addSource("districts", {
        type: "vector",
        tiles: [`${window.location.origin}/api/tiles/{z}/{x}/{y}`],
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

      setMapReady(true);
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Handle district hover
  const handleDistrictHover = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !mapReady) return;

      const now = Date.now();
      if (now - lastHoverTimeRef.current < HOVER_THROTTLE_MS) return;
      lastHoverTimeRef.current = now;

      const queryLayers = [
        "district-base-fill",
        ...VENDOR_IDS.map((v) => `district-${v}-fill`),
      ];
      const activeLayers = queryLayers.filter(
        (id) => map.current?.getLayer(id)
      );
      const features = map.current.queryRenderedFeatures(e.point, {
        layers: activeLayers,
      });

      if (features.length > 0) {
        const feature = features[0];
        const leaid = feature.properties?.leaid;

        if (leaid && leaid !== lastHoveredLeaidRef.current) {
          lastHoveredLeaidRef.current = leaid;
          setHoveredLeaid(leaid);

          map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], leaid]);
          map.current.setFilter("district-hover", ["==", ["get", "leaid"], leaid]);
          map.current.getCanvas().style.cursor = "pointer";

          showTooltip(e.point.x, e.point.y, {
            type: "district",
            leaid,
            name: feature.properties?.name || "Unknown",
            stateAbbrev: feature.properties?.state_abbrev,
            enrollment: feature.properties?.enrollment,
            customerCategory: feature.properties?.fullmind_category,
            salesExecutive: feature.properties?.sales_executive,
          });
        } else if (leaid === lastHoveredLeaidRef.current) {
          updateTooltipPosition(e.point.x, e.point.y);
        }
      } else {
        // Check state hover at low zoom
        if (map.current.getZoom() < 6) {
          const stateFeatures = map.current.queryRenderedFeatures(e.point, {
            layers: ["state-fill"],
          });

          if (stateFeatures.length > 0) {
            const stateName = stateFeatures[0].properties?.name;
            const stateCode = STATE_NAME_TO_ABBREV[stateName];
            if (stateName) {
              map.current.setFilter("state-hover", ["==", ["get", "name"], stateName]);
              map.current.getCanvas().style.cursor = "pointer";
              showTooltip(e.point.x, e.point.y, {
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
    [mapReady, setHoveredLeaid, showTooltip, updateTooltipPosition]
  );

  const clearHover = useCallback(() => {
    if (!map.current) return;
    lastHoveredLeaidRef.current = null;
    setHoveredLeaid(null);
    map.current.setFilter("district-hover-fill", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("district-hover", ["==", ["get", "leaid"], ""]);
    map.current.setFilter("state-hover", ["==", ["get", "name"], ""]);
    map.current.getCanvas().style.cursor = "";
    hideTooltip();
  }, [setHoveredLeaid, hideTooltip]);

  // Handle map click
  const handleClick = useCallback(
    (e: maplibregl.MapMouseEvent) => {
      if (!map.current || !mapReady) return;

      // Check for district click
      const districtFeatures = map.current.queryRenderedFeatures(e.point, {
        layers: [
          "district-base-fill",
          ...VENDOR_IDS.map((v) => `district-${v}-fill`),
        ].filter((id) => map.current?.getLayer(id)),
      });

      if (districtFeatures.length > 0) {
        const leaid = districtFeatures[0].properties?.leaid;
        if (!leaid) return;

        // Visual feedback
        addClickRipple(e.point.x, e.point.y, "plum");

        // In PLAN_ADD mode, shift+click or regular click adds to plan
        if (panelState === "PLAN_ADD") {
          addDistrictToPlan(leaid);
          return;
        }

        // Shift+click toggles multi-select
        if (e.originalEvent.shiftKey) {
          toggleDistrictSelection(leaid);
          return;
        }

        // Regular click selects district
        selectDistrict(leaid);

        // Zoom to district
        const bounds = districtFeatures[0].geometry;
        if (bounds && bounds.type === "Polygon" || bounds?.type === "MultiPolygon") {
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
            addClickRipple(e.point.x, e.point.y, "coral");
            selectState(stateCode);
            map.current.fitBounds(STATE_BBOX[stateCode], {
              padding: { top: 50, bottom: 50, left: 380, right: 50 },
              duration: 800,
            });
          }
        }
      }
    },
    [mapReady, panelState, selectDistrict, selectState, addClickRipple, addDistrictToPlan, toggleDistrictSelection]
  );

  // Attach/detach event handlers
  useEffect(() => {
    if (!map.current || !mapReady) return;

    map.current.on("mousemove", handleDistrictHover);
    map.current.on("click", handleClick);
    map.current.on("mouseleave", clearHover);

    return () => {
      map.current?.off("mousemove", handleDistrictHover);
      map.current?.off("click", handleClick);
      map.current?.off("mouseleave", clearHover);
    };
  }, [mapReady, handleDistrictHover, handleClick, clearHover]);

  // Update selected district highlight
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter: ["==", ["get", string], string] = selectedLeaid
      ? ["==", ["get", "leaid"], selectedLeaid]
      : ["==", ["get", "leaid"], ""];
    map.current.setFilter("district-selected-fill", filter);
    map.current.setFilter("district-selected", filter);
  }, [selectedLeaid, mapReady]);

  // Toggle vendor layer visibility
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
  }, [activeVendors, mapReady]);

  // Apply filter expression to all layers
  useEffect(() => {
    if (!map.current || !mapReady) return;
    const filter = buildFilterExpression(filterOwner, filterPlanId);

    // Apply to base layers
    map.current.setFilter("district-base-fill", filter);
    map.current.setFilter("district-base-boundary", filter);

    // Apply to each vendor layer (combine with the vendor's own "has" filter)
    for (const vendorId of VENDOR_IDS) {
      const layerId = `district-${vendorId}-fill`;
      if (!map.current.getLayer(layerId)) continue;
      const config = VENDOR_CONFIGS[vendorId];
      const vendorFilter: any = ["has", config.tileProperty];
      const combined = filter
        ? ["all", vendorFilter, filter]
        : vendorFilter;
      map.current.setFilter(layerId, combined);
    }
  }, [filterOwner, filterPlanId, mapReady]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const { panelState, goBack, clearSelection } = useMapV2Store.getState();
        if (panelState !== "BROWSE") {
          goBack();
        } else {
          clearSelection();
          // Zoom back to US
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

  const clickRipples = useMapV2Store((s) => s.clickRipples);
  const removeClickRipple = useMapV2Store((s) => s.removeClickRipple);

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
      <MapV2Tooltip />
    </div>
  );
}
