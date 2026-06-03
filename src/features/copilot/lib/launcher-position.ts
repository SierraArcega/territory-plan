export interface Position {
  x: number;
  y: number;
}

/** Diameter of the collapsed sparkle icon, in px. */
export const LAUNCHER_SIZE = 44;
/** localStorage key for the persisted launcher position. */
export const LAUNCHER_POS_KEY = "copilot:launcher-pos";

const MARGIN = 8;
const DEFAULT_RIGHT_GAP = 20;
const DEFAULT_BOTTOM_GAP = 76; // clears a ~44px pager footer + breathing room

/** Keep the icon fully on screen with an 8px margin on every edge. */
export function clampToViewport(pos: Position, size: number, vw: number, vh: number): Position {
  const clamp = (v: number, hi: number) => Math.min(Math.max(v, MARGIN), Math.max(MARGIN, hi));
  return {
    x: clamp(pos.x, vw - size - MARGIN),
    y: clamp(pos.y, vh - size - MARGIN),
  };
}

/** Default resting spot: bottom-right, raised above the pager footer. */
export function defaultLauncherPosition(
  vw: number = typeof window !== "undefined" ? window.innerWidth : 1024,
  vh: number = typeof window !== "undefined" ? window.innerHeight : 768,
): Position {
  return clampToViewport(
    { x: vw - LAUNCHER_SIZE - DEFAULT_RIGHT_GAP, y: vh - LAUNCHER_SIZE - DEFAULT_BOTTOM_GAP },
    LAUNCHER_SIZE,
    vw,
    vh,
  );
}

/** Read + clamp the persisted position, or null if absent/invalid. */
export function readStoredPosition(): Position | null {
  try {
    const raw = localStorage.getItem(LAUNCHER_POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Position>;
    if (typeof p?.x === "number" && typeof p?.y === "number") {
      return clampToViewport({ x: p.x, y: p.y }, LAUNCHER_SIZE, window.innerWidth, window.innerHeight);
    }
    return null;
  } catch {
    return null;
  }
}
