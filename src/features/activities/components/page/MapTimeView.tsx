"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { MapPin } from "lucide-react";
import type { ActivityListItem } from "@/features/shared/types/api-types";

const CATEGORY_DOTS: Record<string, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

// Note: full MapLibre embedding (with the activities layer from
// src/features/map/lib/layers.ts) is deferred to a follow-up. For now this
// view groups activities by state on a simple ranked list while still showing
// the time ruler so the temporal pivot stays usable.
export default function MapTimeView({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
}) {
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const ordered = useMemo(
    () =>
      activities
        .filter((a) => a.startDate)
        .sort((a, b) => (a.startDate || "").localeCompare(b.startDate || "")),
    [activities]
  );

  const byState = useMemo(() => {
    const map = new Map<string, ActivityListItem[]>();
    for (const a of activities) {
      for (const st of a.stateAbbrevs.length > 0 ? a.stateAbbrevs : ["—"]) {
        if (!map.has(st)) map.set(st, []);
        map.get(st)!.push(a);
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [activities]);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: time ruler */}
      <div className="w-[260px] flex-shrink-0 border-r border-[#E2DEEC] bg-white overflow-y-auto">
        <div className="px-4 py-3 border-b border-[#E2DEEC]">
          <div className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
            Time ruler
          </div>
          <div className="text-xs text-[#6E6390]">
            {ordered.length} activit{ordered.length === 1 ? "y" : "ies"}
          </div>
        </div>
        <ol className="p-2 space-y-1">
          {ordered.map((a) => {
            const dot = CATEGORY_DOTS[a.category] ?? "#A69DC0";
            const active = highlightId === a.id;
            return (
              <li key={a.id}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlightId(a.id)}
                  onMouseLeave={() => setHighlightId(null)}
                  onClick={() => onActivityClick(a.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                    active ? "bg-[#FEF2F1]" : "hover:bg-[#F7F5FA]"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dot }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-[#403770] truncate">{a.title}</div>
                    <div className="text-[10px] text-[#8A80A8]">
                      {a.startDate ? format(new Date(a.startDate), "MMM d, h:mm a") : ""}
                      {a.stateAbbrevs[0] && ` · ${a.stateAbbrevs[0]}`}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Right: state list (placeholder for embedded MapLibre) */}
      <div className="flex-1 overflow-auto p-6 bg-[#FFFCFA]">
        <div className="text-[10px] uppercase tracking-wider font-bold text-[#A69DC0] mb-3">
          Activity by state
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {byState.map(([state, items]) => (
            <div
              key={state}
              className="bg-white border border-[#E2DEEC] rounded-xl p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#403770]">
                  <MapPin className="w-3.5 h-3.5" />
                  {state}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-bold text-[#A69DC0]">
                  {items.length}
                </span>
              </div>
              <ul className="space-y-1">
                {items.slice(0, 5).map((a) => {
                  const dot = CATEGORY_DOTS[a.category] ?? "#A69DC0";
                  const active = highlightId === a.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => onActivityClick(a.id)}
                        className={`w-full flex items-center gap-2 px-1.5 py-1 rounded text-left transition-colors text-xs ${
                          active ? "bg-[#FEF2F1]" : "hover:bg-[#F7F5FA]"
                        }`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: dot }}
                        />
                        <span className="truncate text-[#403770]">{a.title}</span>
                      </button>
                    </li>
                  );
                })}
                {items.length > 5 && (
                  <li className="text-[10px] text-[#A69DC0] px-1.5">
                    +{items.length - 5} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-[11px] text-[#A69DC0]">
          Map embed (MapLibre `activities` layer) lands in a follow-up — the time ruler is fully functional.
        </p>
      </div>
    </div>
  );
}
