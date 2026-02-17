import type maplibregl from "maplibre-gl";

// Lightweight global ref for the MapLibre map instance.
// Used by TetherLine to call map.project() for screen-coordinate conversion.
// Set by MapV2Container on map load, cleared on unmount.
export const mapV2Ref: { current: maplibregl.Map | null } = { current: null };
