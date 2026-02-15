"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import { getLayerConfig } from "@/lib/map-v2-layers";

export default function LayerLegend() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);
  const config = getLayerConfig(activeLayer);

  if (config.legend.length === 0) return null;

  return (
    <div className="px-3 pb-3">
      <div className="bg-gray-50 rounded-xl p-2.5">
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Legend
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {config.legend.map((entry) => (
            <div key={entry.label} className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-[11px] text-gray-500">{entry.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
