"use client";

import { useRef, useEffect } from "react";
import { useMapV2Store, type LayerType } from "@/lib/map-v2-store";
import { getLayerConfig } from "@/lib/map-v2-layers";

const layers: Array<{
  id: LayerType;
  label: string;
  dotColor: string;
  description: string;
}> = [
  { id: "customers", label: "Fullmind Customers", dotColor: "#403770", description: "Districts by customer status" },
  { id: "state", label: "By State", dotColor: "#6EA3BE", description: "Districts grouped by state" },
  { id: "owner", label: "By Owner", dotColor: "#22C55E", description: "Districts by sales executive" },
  { id: "territory_plan", label: "Territory Plans", dotColor: "#F59E0B", description: "Districts by assigned plan" },
  { id: "competitors", label: "Competitors", dotColor: "#F37167", description: "Districts by dominant vendor" },
  { id: "enrollment", label: "Enrollment", dotColor: "#8B5CF6", description: "Districts by student count" },
  { id: "revenue", label: "Revenue", dotColor: "#403770", description: "Districts by Fullmind revenue" },
];

export default function LayerBubble() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);
  const setActiveLayer = useMapV2Store((s) => s.setActiveLayer);
  const layerBubbleOpen = useMapV2Store((s) => s.layerBubbleOpen);
  const setLayerBubbleOpen = useMapV2Store((s) => s.setLayerBubbleOpen);
  const ref = useRef<HTMLDivElement>(null);

  const active = layers.find((l) => l.id === activeLayer) || layers[0];
  const config = getLayerConfig(activeLayer);

  // Close on outside click
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setLayerBubbleOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  // Close on Escape
  useEffect(() => {
    if (!layerBubbleOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLayerBubbleOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [layerBubbleOpen, setLayerBubbleOpen]);

  return (
    <div ref={ref} className="absolute bottom-6 right-6 z-10">
      {/* Expanded popover */}
      {layerBubbleOpen && (
        <div
          className="absolute bottom-full right-0 mb-2 w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
          style={{ transformOrigin: "bottom right" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 pt-3 pb-2">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
              Map Layer
            </span>
            <button
              onClick={() => setLayerBubbleOpen(false)}
              className="w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-plum hover:bg-gray-100 transition-colors"
              aria-label="Close layer picker"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Layer list */}
          <div className="px-1 pb-1">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => {
                  setActiveLayer(layer.id);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeLayer === layer.id ? "bg-plum/5" : "hover:bg-gray-50"
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: layer.dotColor }}
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm truncate ${
                      activeLayer === layer.id ? "font-medium text-plum" : "text-gray-700"
                    }`}
                  >
                    {layer.label}
                  </div>
                  <div className="text-xs text-gray-400 truncate">{layer.description}</div>
                </div>
                {activeLayer === layer.id && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
                    <path d="M3 7L6 10L11 4" stroke="#403770" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Legend */}
          {config.legend.length > 0 && (
            <div className="px-3 pb-3 pt-1 border-t border-gray-100">
              <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5 mt-2">
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
          )}
        </div>
      )}

      {/* Collapsed pill */}
      <button
        onClick={() => setLayerBubbleOpen(!layerBubbleOpen)}
        className={`
          flex items-center gap-2 px-3 py-2
          bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60
          hover:shadow-xl transition-all duration-150
          ${layerBubbleOpen ? "ring-2 ring-plum/20" : ""}
        `}
        aria-label={`Map layer: ${active.label}. Click to change.`}
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: active.dotColor }}
        />
        <span className="text-sm font-medium text-gray-700">{active.label}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-gray-400 transition-transform duration-150 ${layerBubbleOpen ? "rotate-180" : ""}`}
        >
          <path d="M2.5 6.5L5 4L7.5 6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
