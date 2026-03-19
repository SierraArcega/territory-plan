"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import { LAYER_ORDER, LAYER_COLORS, type LayerType } from "@/features/map/lib/layers";

const LAYER_LABELS: Record<LayerType, string> = {
  districts:  "Districts",
  plans:      "Plans",
  contacts:   "Contacts",
  vacancies:  "Vacancies",
  activities: "Activities",
};

interface ResultsTabStripProps {
  counts: Partial<Record<LayerType, number>>;
}

export default function ResultsTabStrip({ counts }: ResultsTabStripProps) {
  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const activeResultsTab = useMapV2Store((s) => s.activeResultsTab);
  const setActiveResultsTab = useMapV2Store((s) => s.setActiveResultsTab);

  const visibleTabs = LAYER_ORDER.filter((layer) => activeLayers.has(layer));

  // Only render the strip when there are overlay tabs beyond districts
  if (visibleTabs.length <= 1) return null;

  return (
    <div className="shrink-0 border-b border-[#E2DEEC] overflow-x-auto">
      <div className="flex gap-0">
        {visibleTabs.map((layer) => {
          const isActive = activeResultsTab === layer;
          const color = LAYER_COLORS[layer];
          const count = counts[layer];

          return (
            <button
              key={layer}
              onClick={() => setActiveResultsTab(layer)}
              className="relative shrink-0 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap"
              style={{
                color: isActive ? "#403770" : "#8A80A8",
                fontWeight: isActive ? 700 : 500,
              }}
            >
              {LAYER_LABELS[layer]}
              {count != null && (
                <span
                  className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor: isActive ? `${color}18` : "#f0edf5",
                    color: isActive ? color : "#8A80A8",
                  }}
                >
                  {count.toLocaleString()}
                </span>
              )}

              {/* Active indicator bar */}
              {isActive && (
                <span
                  className="absolute bottom-0 left-2 right-2 h-[2px] rounded-full"
                  style={{ backgroundColor: color }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
