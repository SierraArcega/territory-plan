import type { MapGeoJSONFeature } from "maplibre-gl";

/**
 * Given an ordered list of rendered features at a click point, prefers
 * non-rollup (leaf) districts so that clicking anywhere inside a rollup's
 * visual bounds selects the specific child at that point (e.g., District 5
 * in NYC), not the rollup itself. Falls back to the first feature if no
 * non-rollup is present.
 */
export function pickDistrictFeature(
  features: MapGeoJSONFeature[]
): MapGeoJSONFeature | undefined {
  if (features.length === 0) return undefined;
  const child = features.find((f) => f.properties?.is_rollup !== true);
  return child ?? features[0];
}
