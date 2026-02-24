"use client";

import dynamic from "next/dynamic";
import { useMapV2Store } from "@/features/map/lib/store";
import TransitionLegend from "./TransitionLegend";
import type { MapV2ContainerProps } from "./MapV2Container";

const MapV2Container = dynamic(() => import("./MapV2Container"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-[#F8F7F4] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-plum/20 border-t-plum rounded-full tile-loading-spinner" />
        <span className="text-sm text-gray-400">Loading map...</span>
      </div>
    </div>
  ),
});

/**
 * Single map instance for the "Changes" (diff layer) comparison view.
 * Passes `fy2` param to get both FYs' category columns in the tile.
 * The transition fill expression is applied by MapV2Container's layer setup.
 */
export default function ChangesMap() {
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);

  const tileUrlSuffix = `&fy2=${compareFyB}`;

  // Property map so tooltip handler reads the _a/_b suffixed properties
  const tooltipPropertyMap: Record<string, string> = {
    fullmind_category_a: "fullmind_category_a",
    fullmind_category_b: "fullmind_category_b",
  };

  const mapProps: MapV2ContainerProps = {
    fyOverride: compareFyA,
    tileUrlSuffix,
    refKey: "primary",
    tooltipPropertyMap,
  };

  return (
    <>
      <MapV2Container {...mapProps} />
      <TransitionLegend />
    </>
  );
}
