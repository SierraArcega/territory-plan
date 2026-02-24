"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import SideBySideMap from "./SideBySideMap";
import ChangesMap from "./ChangesMap";

/**
 * Wrapper that renders either SideBySideMap or ChangesMap based on the
 * `compareView` store value. Replaces MapV2Container in the shell when
 * compare mode is active.
 */
export default function ComparisonMapShell() {
  const compareView = useMapV2Store((s) => s.compareView);

  if (compareView === "side_by_side") {
    return <SideBySideMap />;
  }

  return <ChangesMap />;
}
