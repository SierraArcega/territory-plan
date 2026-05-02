"use client";

import { useState } from "react";
import { format } from "date-fns";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import type { ActivityCategory } from "@/features/activities/types";

const CATEGORY_DOT: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

export interface ClusterData {
  /** Stable key (e.g., state abbrev) */
  key: string;
  /** Human label rendered in the tooltip header */
  label: string;
  items: ActivityListItem[];
}

/**
 * Visual pin used by MapTimeView. Renders a circular badge with the count, an
 * optional team-avatar stack slot underneath, and a hover tooltip listing the
 * first few activities in the cluster.
 *
 * Positioning is delegated to MapTimeView via maplibregl.Marker — this
 * component renders only the marker DOM.
 */
export default function PinCluster({
  cluster,
  onActivityClick,
}: {
  cluster: ClusterData;
  onActivityClick: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const items = cluster.items;
  const primary = items[0];
  const dot = primary
    ? CATEGORY_DOT[primary.category]
    : "#403770";
  const size = Math.min(52, 24 + items.length * 4);

  return (
    <div
      className="relative cursor-pointer"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => primary && onActivityClick(primary.id)}
      style={{ zIndex: hovered ? 10 : 1 }}
    >
      <div
        className="rounded-full text-white inline-flex items-center justify-center font-bold tabular-nums transition-all duration-150"
        style={{
          width: size,
          height: size,
          backgroundColor: dot,
          fontSize: 12,
          border: "3px solid #fff",
          boxShadow: hovered
            ? "0 6px 20px rgba(64,55,112,0.3)"
            : "0 2px 8px rgba(64,55,112,0.2)",
        }}
      >
        {items.length}
      </div>

      {/* Team-avatar stack slot — Wave 6 / future enrichment fills with owner avatars. */}
      <div
        className="absolute left-1/2 -translate-x-1/2 bg-white rounded-full px-1 py-[1.5px] shadow-[0_1px_3px_rgba(64,55,112,0.15)] hidden"
        style={{ top: size - 6 }}
        aria-hidden
      />

      {hovered && primary && (
        <div
          className="absolute left-1/2 -translate-x-1/2 bg-white rounded-[10px] border border-[#D4CFE2] shadow-[0_10px_20px_rgba(64,55,112,0.15)] p-2.5"
          style={{
            top: size + 8,
            minWidth: 220,
            maxWidth: 280,
            zIndex: 20,
          }}
        >
          <div className="text-xs font-bold text-[#403770] mb-1.5">{cluster.label}</div>
          {items.slice(0, 4).map((it) => (
            <div key={it.id} className="text-[11px] text-[#6E6390] py-0.5">
              <span className="text-[#8A80A8] tabular-nums">
                {it.startDate ? format(new Date(it.startDate), "MMM d") : "—"}
              </span>
              {" · "}
              <span>{it.title}</span>
            </div>
          ))}
          {items.length > 4 && (
            <div className="text-[10px] text-[#8A80A8] mt-1">
              +{items.length - 4} more
            </div>
          )}
        </div>
      )}
    </div>
  );
}
