"use client";

import { useState, useRef, useEffect } from "react";
import { useMapV2Store, type LayerType } from "@/lib/map-v2-store";

const layers: Array<{
  id: LayerType;
  label: string;
  dotColor: string;
  description: string;
}> = [
  {
    id: "customers",
    label: "Fullmind Customers",
    dotColor: "#403770",
    description: "Districts by customer status",
  },
  {
    id: "state",
    label: "By State",
    dotColor: "#6EA3BE",
    description: "Districts grouped by state",
  },
  {
    id: "owner",
    label: "By Owner",
    dotColor: "#22C55E",
    description: "Districts by sales executive",
  },
  {
    id: "territory_plan",
    label: "Territory Plans",
    dotColor: "#F59E0B",
    description: "Districts by assigned plan",
  },
  {
    id: "competitors",
    label: "Competitors",
    dotColor: "#F37167",
    description: "Districts by dominant vendor",
  },
  {
    id: "enrollment",
    label: "Enrollment",
    dotColor: "#8B5CF6",
    description: "Districts by student count",
  },
  {
    id: "revenue",
    label: "Revenue",
    dotColor: "#403770",
    description: "Districts by Fullmind revenue",
  },
];

export default function LayerPicker() {
  const activeLayer = useMapV2Store((s) => s.activeLayer);
  const setActiveLayer = useMapV2Store((s) => s.setActiveLayer);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = layers.find((l) => l.id === activeLayer) || layers[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-3 py-2 bg-gray-50 border border-gray-200/60 rounded-xl hover:bg-gray-100 transition-all text-left group"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: active.dotColor }}
        />
        <span className="flex-1 text-sm font-medium text-gray-700 truncate">
          {active.label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-20 animate-in fade-in slide-in-from-top-1 duration-150">
          {layers.map((layer) => (
            <button
              key={layer.id}
              onClick={() => {
                setActiveLayer(layer.id);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-gray-50 transition-colors ${
                activeLayer === layer.id ? "bg-plum/5" : ""
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: layer.dotColor }}
              />
              <div className="flex-1 min-w-0">
                <div
                  className={`text-sm truncate ${
                    activeLayer === layer.id
                      ? "font-medium text-plum"
                      : "text-gray-700"
                  }`}
                >
                  {layer.label}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {layer.description}
                </div>
              </div>
              {activeLayer === layer.id && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7L6 10L11 4"
                    stroke="#403770"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
