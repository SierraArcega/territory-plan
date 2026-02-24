import type maplibregl from "maplibre-gl";

export type MapRefKey = "primary" | "secondary";

/**
 * Dual global refs for MapLibre map instances.
 * - `primary`: The main map (normal mode + left pane in side-by-side)
 * - `secondary`: The right pane in side-by-side mode (null when not in side-by-side)
 *
 * Set by MapV2Container on map load, cleared on unmount.
 */
export const mapV2Refs: Record<MapRefKey, maplibregl.Map | null> = {
  primary: null,
  secondary: null,
};

/**
 * Legacy compatibility shim. Consumers that previously read `mapV2Ref.current`
 * now read `mapV2Refs.primary`.
 */
export const mapV2Ref: { current: maplibregl.Map | null } = {
  get current() {
    return mapV2Refs.primary;
  },
  set current(value: maplibregl.Map | null) {
    mapV2Refs.primary = value;
  },
};
