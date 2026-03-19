/**
 * MapLibre layer definitions for overlay pin layers (contacts, vacancies, activities).
 *
 * Pin colors per spec:
 *   Contacts:   Coral   #F37167   Circle
 *   Vacancies:  Golden  #FFCF70   Diamond
 *   Activities: Steel   #6EA3BE   Star
 *   Plans:      Plum    #403770   (polygon fill, not pins)
 */

import type { LayerSpecification, SourceSpecification } from "maplibre-gl";

// Source IDs
export const CONTACTS_SOURCE = "overlay-contacts";
export const VACANCIES_SOURCE = "overlay-vacancies";
export const ACTIVITIES_SOURCE = "overlay-activities";
export const PLANS_SOURCE = "overlay-plans";

// Layer IDs
export const CONTACTS_CLUSTER_LAYER = "overlay-contacts-cluster";
export const CONTACTS_CLUSTER_COUNT = "overlay-contacts-cluster-count";
export const CONTACTS_POINT_LAYER = "overlay-contacts-point";

export const VACANCIES_CLUSTER_LAYER = "overlay-vacancies-cluster";
export const VACANCIES_CLUSTER_COUNT = "overlay-vacancies-cluster-count";
export const VACANCIES_POINT_LAYER = "overlay-vacancies-point";

export const ACTIVITIES_CLUSTER_LAYER = "overlay-activities-cluster";
export const ACTIVITIES_CLUSTER_COUNT = "overlay-activities-cluster-count";
export const ACTIVITIES_POINT_LAYER = "overlay-activities-point";

export const PLANS_FILL_LAYER = "overlay-plans-fill";
export const PLANS_OUTLINE_LAYER = "overlay-plans-outline";

// All overlay layer IDs in hit-test priority order (highest priority first).
// Activities render topmost, then vacancies, then contacts.
export const ALL_OVERLAY_POINT_LAYERS = [
  ACTIVITIES_POINT_LAYER,
  VACANCIES_POINT_LAYER,
  CONTACTS_POINT_LAYER,
] as const;

export const ALL_OVERLAY_CLUSTER_LAYERS = [
  CONTACTS_CLUSTER_LAYER,
  VACANCIES_CLUSTER_LAYER,
  ACTIVITIES_CLUSTER_LAYER,
] as const;

/** Cluster radius and max zoom for all pin layers. */
const CLUSTER_RADIUS = 50;
const CLUSTER_MAX_ZOOM = 8;

/** Create a clustered GeoJSON source specification. */
export function createClusteredSource(): SourceSpecification {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    cluster: true,
    clusterMaxZoom: CLUSTER_MAX_ZOOM,
    clusterRadius: CLUSTER_RADIUS,
  };
}

/** Create a non-clustered GeoJSON source specification (for plans polygons). */
export function createGeoJSONSource(): SourceSpecification {
  return {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  };
}

/**
 * Get all MapLibre layer specs for the contact overlay.
 */
export function getContactLayers(): LayerSpecification[] {
  return [
    // Cluster circle
    {
      id: CONTACTS_CLUSTER_LAYER,
      type: "circle",
      source: CONTACTS_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#F37167",
        "circle-radius": [
          "step", ["get", "point_count"],
          16, 10, 20, 50, 24,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
    // Cluster count label
    {
      id: CONTACTS_CLUSTER_COUNT,
      type: "symbol",
      source: CONTACTS_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 11,
        "text-font": ["Open Sans Bold"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
    // Individual contact point
    {
      id: CONTACTS_POINT_LAYER,
      type: "circle",
      source: CONTACTS_SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#F37167",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 7, 12, 9],
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
  ];
}

/**
 * Get all MapLibre layer specs for the vacancy overlay.
 */
export function getVacancyLayers(): LayerSpecification[] {
  return [
    // Cluster circle
    {
      id: VACANCIES_CLUSTER_LAYER,
      type: "circle",
      source: VACANCIES_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#FFCF70",
        "circle-radius": [
          "step", ["get", "point_count"],
          16, 10, 20, 50, 24,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
    // Cluster count label
    {
      id: VACANCIES_CLUSTER_COUNT,
      type: "symbol",
      source: VACANCIES_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 11,
        "text-font": ["Open Sans Bold"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#403770",
      },
    } satisfies LayerSpecification,
    // Individual vacancy point
    {
      id: VACANCIES_POINT_LAYER,
      type: "circle",
      source: VACANCIES_SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#FFCF70",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 7, 12, 9],
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
  ];
}

/**
 * Get all MapLibre layer specs for the activity overlay.
 */
export function getActivityLayers(): LayerSpecification[] {
  return [
    // Cluster circle
    {
      id: ACTIVITIES_CLUSTER_LAYER,
      type: "circle",
      source: ACTIVITIES_SOURCE,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#6EA3BE",
        "circle-radius": [
          "step", ["get", "point_count"],
          16, 10, 20, 50, 24,
        ],
        "circle-opacity": 0.85,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
    // Cluster count label
    {
      id: ACTIVITIES_CLUSTER_COUNT,
      type: "symbol",
      source: ACTIVITIES_SOURCE,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 11,
        "text-font": ["Open Sans Bold"],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
    // Individual activity point
    {
      id: ACTIVITIES_POINT_LAYER,
      type: "circle",
      source: ACTIVITIES_SOURCE,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#6EA3BE",
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 5, 9, 7, 12, 9],
        "circle-opacity": 0.9,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#FFFFFF",
      },
    } satisfies LayerSpecification,
  ];
}

/**
 * Get MapLibre layer specs for plan district polygon overlay.
 * Very subtle fill (0.08 opacity) so district choropleth shows through,
 * with a prominent outline (2.5px, 0.9 opacity) for clear plan boundaries.
 */
export function getPlanLayers(): LayerSpecification[] {
  return [
    // Very subtle fill — just enough to hint at plan coverage without obscuring choropleth
    {
      id: PLANS_FILL_LAYER,
      type: "fill",
      source: PLANS_SOURCE,
      paint: {
        "fill-color": ["coalesce", ["get", "planColor"], "#7B6BA4"],
        "fill-opacity": 0.08,
      },
    } satisfies LayerSpecification,
    // Prominent outline for clear plan boundaries
    {
      id: PLANS_OUTLINE_LAYER,
      type: "line",
      source: PLANS_SOURCE,
      paint: {
        "line-color": ["coalesce", ["get", "planColor"], "#7B6BA4"],
        "line-width": 2.5,
        "line-opacity": 0.9,
      },
    } satisfies LayerSpecification,
  ];
}

/** Map layer ID back to overlay type for click handling. */
export function layerIdToOverlayType(
  layerId: string
): "contacts" | "vacancies" | "activities" | "plans" | null {
  if (layerId.includes("contacts")) return "contacts";
  if (layerId.includes("vacancies")) return "vacancies";
  if (layerId.includes("activities")) return "activities";
  if (layerId.includes("plans")) return "plans";
  return null;
}

/** Map overlay type to the right panel content type. */
export function overlayTypeToPanel(
  type: "contacts" | "vacancies" | "activities" | "plans"
): string {
  switch (type) {
    case "contacts":
      return "contact_detail";
    case "vacancies":
      return "vacancy_detail";
    case "activities":
      return "activity_edit";
    case "plans":
      return "plan_card";
  }
}
