"use client";

import { useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useMapV2Store } from "@/features/map/lib/store";
import { mapV2Refs } from "@/features/map/lib/ref";

const MapV2Container = dynamic(() => import("./MapV2Container"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#F8F7F4] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-plum/20 border-t-plum rounded-full tile-loading-spinner" />
        <span className="text-sm text-gray-400">Loading map...</span>
      </div>
    </div>
  ),
});

function formatFy(fy: string): string {
  return fy.replace("fy", "FY");
}

/**
 * Side-by-side comparison: two MapV2Container instances in a 50/50 horizontal split
 * with synchronized pan/zoom. Left = FY_A, Right = FY_B.
 */
export default function SideBySideMap() {
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);
  const syncing = useRef(false);

  // Synchronize camera between both map instances
  const syncCamera = useCallback((source: "primary" | "secondary") => {
    if (syncing.current) return;

    const sourceMap = mapV2Refs[source];
    const targetKey = source === "primary" ? "secondary" : "primary";
    const targetMap = mapV2Refs[targetKey];

    if (!sourceMap || !targetMap) return;

    syncing.current = true;

    const center = sourceMap.getCenter();
    const zoom = sourceMap.getZoom();
    const bearing = sourceMap.getBearing();
    const pitch = sourceMap.getPitch();

    targetMap.jumpTo({ center, zoom, bearing, pitch });

    requestAnimationFrame(() => {
      syncing.current = false;
    });
  }, []);

  // Attach sync listeners after both maps may be available
  useEffect(() => {
    const attachListeners = () => {
      const primary = mapV2Refs.primary;
      const secondary = mapV2Refs.secondary;
      if (!primary || !secondary) return;

      const onPrimaryMove = () => syncCamera("primary");
      const onSecondaryMove = () => syncCamera("secondary");

      primary.on("move", onPrimaryMove);
      secondary.on("move", onSecondaryMove);

      // Do an initial sync from primary to secondary
      syncCamera("primary");

      return () => {
        primary.off("move", onPrimaryMove);
        secondary.off("move", onSecondaryMove);
      };
    };

    // Poll for both maps to be available (they load async)
    let cleanup: (() => void) | undefined;
    let attempts = 0;
    const pollInterval = setInterval(() => {
      attempts++;
      if (mapV2Refs.primary && mapV2Refs.secondary) {
        cleanup = attachListeners();
        clearInterval(pollInterval);
      }
      if (attempts > 100) clearInterval(pollInterval); // Give up after ~5s
    }, 50);

    return () => {
      clearInterval(pollInterval);
      cleanup?.();
    };
  }, [syncCamera]);

  return (
    <div className="absolute inset-0 grid grid-cols-2">
      {/* Left pane: FY_A */}
      <div className="relative overflow-hidden">
        <MapV2Container fyOverride={compareFyA} refKey="primary" />
        {/* FY badge */}
        <div className="absolute top-3 left-3 z-10 bg-plum text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none">
          {formatFy(compareFyA)}
        </div>
      </div>

      {/* Vertical divider */}
      <div className="absolute left-1/2 top-0 bottom-0 w-px bg-plum/20 z-10 pointer-events-none" />

      {/* Right pane: FY_B */}
      <div className="relative overflow-hidden">
        <MapV2Container fyOverride={compareFyB} refKey="secondary" />
        {/* FY badge */}
        <div className="absolute top-3 left-3 z-10 bg-plum text-white text-[10px] font-bold px-2 py-0.5 rounded-md pointer-events-none">
          {formatFy(compareFyB)}
        </div>
      </div>
    </div>
  );
}
