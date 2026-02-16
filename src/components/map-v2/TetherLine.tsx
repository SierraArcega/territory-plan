"use client";

import { useState, useEffect, useCallback } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";
import { mapV2Ref } from "@/lib/map-v2-ref";

interface LineCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export default function TetherLine() {
  const detailPopout = useMapV2Store((s) => s.detailPopout);
  const leaid = detailPopout?.leaid ?? null;
  const { data } = useDistrictDetail(leaid);

  const [line, setLine] = useState<LineCoords | null>(null);

  const updateLine = useCallback(() => {
    const map = mapV2Ref.current;
    if (!map || !data?.district) {
      setLine(null);
      return;
    }

    const { centroidLat, centroidLng } = data.district;
    if (centroidLat == null || centroidLng == null) {
      setLine(null);
      return;
    }

    // Project district lat/lng to screen coords
    const point = map.project([centroidLng, centroidLat]);

    // Find the floating panel element
    const panel = document.querySelector("[data-detail-popout]");
    if (!panel) {
      setLine(null);
      return;
    }

    const rect = panel.getBoundingClientRect();

    // Hide if district point is off-screen
    if (
      point.x < -50 ||
      point.x > window.innerWidth + 50 ||
      point.y < -50 ||
      point.y > window.innerHeight + 50
    ) {
      setLine(null);
      return;
    }

    // Connect to the nearest edge midpoint of the panel
    let targetX: number;
    let targetY: number;

    if (point.x < rect.left) {
      // District is to the left of the panel
      targetX = rect.left;
      targetY = Math.max(rect.top, Math.min(point.y, rect.bottom));
    } else if (point.x > rect.right) {
      // District is to the right
      targetX = rect.right;
      targetY = Math.max(rect.top, Math.min(point.y, rect.bottom));
    } else if (point.y < rect.top) {
      // District is above
      targetX = Math.max(rect.left, Math.min(point.x, rect.right));
      targetY = rect.top;
    } else if (point.y > rect.bottom) {
      // District is below
      targetX = Math.max(rect.left, Math.min(point.x, rect.right));
      targetY = rect.bottom;
    } else {
      // District point is inside the panel — connect to left edge
      targetX = rect.left;
      targetY = rect.top + rect.height / 2;
    }

    setLine({ x1: point.x, y1: point.y, x2: targetX, y2: targetY });
  }, [data]);

  useEffect(() => {
    const map = mapV2Ref.current;
    if (!map || !detailPopout) {
      setLine(null);
      return;
    }

    updateLine();

    // Update on map pan/zoom
    map.on("move", updateLine);

    // Poll for panel position changes (drag)
    let rafId: number;
    const poll = () => {
      updateLine();
      rafId = requestAnimationFrame(poll);
    };
    rafId = requestAnimationFrame(poll);

    return () => {
      map.off("move", updateLine);
      cancelAnimationFrame(rafId);
    };
  }, [detailPopout, updateLine]);

  if (!line) return null;

  return (
    <svg
      className="absolute inset-0 z-10 pointer-events-none"
      width="100%"
      height="100%"
    >
      {/* Dashed connector line */}
      <line
        x1={line.x1}
        y1={line.y1}
        x2={line.x2}
        y2={line.y2}
        stroke="#F37167"
        strokeWidth="1.5"
        strokeDasharray="6 4"
        strokeLinecap="round"
        opacity="0.7"
      />
      {/* Dot at district point */}
      <circle cx={line.x1} cy={line.y1} r="4" fill="#F37167" opacity="0.8" />
    </svg>
  );
}
