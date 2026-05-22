import { fipsToAbbrev } from "@/lib/states";

export type Bbox = [[number, number], [number, number]];

/**
 * Compute a camera bounding box covering the territory of a set of district
 * leaids, by deriving each district's state (first 2 chars = NCES/Census FIPS)
 * and unioning the per-state bounding boxes. The `stateBbox` map is injected by
 * the caller (MapV2Container owns the canonical `STATE_BBOX`) so this module
 * stays free of the heavy map component. Returns null when no leaid resolves to
 * a known state bbox — the caller should fall back to the default US bounds.
 */
export function boundsForLeaids(
  leaids: string[],
  stateBbox: Record<string, Bbox>,
): Bbox | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  const seen = new Set<string>();
  for (const leaid of leaids) {
    if (typeof leaid !== "string" || leaid.length < 2) continue;
    const abbrev = fipsToAbbrev(leaid.slice(0, 2));
    if (!abbrev || seen.has(abbrev)) continue;
    seen.add(abbrev);
    const bbox = stateBbox[abbrev];
    if (!bbox) continue;
    found = true;
    if (bbox[0][0] < minLng) minLng = bbox[0][0];
    if (bbox[0][1] < minLat) minLat = bbox[0][1];
    if (bbox[1][0] > maxLng) maxLng = bbox[1][0];
    if (bbox[1][1] > maxLat) maxLat = bbox[1][1];
  }

  if (!found) return null;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
