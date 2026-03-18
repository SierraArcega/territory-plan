"use client";

import type { OverlayLayerType } from "@/features/map/lib/store";

interface LayerToggleProps {
  layer: OverlayLayerType;
  label: string;
  color: string;
  checked: boolean;
  count?: number;
  isLoading?: boolean;
  onToggle: (layer: OverlayLayerType) => void;
}

export default function LayerToggle({
  layer,
  label,
  color,
  checked,
  count,
  isLoading,
  onToggle,
}: LayerToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onToggle(layer)}
        className={[
          "relative inline-flex items-center w-8 h-[18px] rounded-full cursor-pointer",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1",
          checked ? "bg-[#403770]" : "bg-[#C2BBD4]",
        ].join(" ")}
      >
        <span
          className={[
            "absolute left-[2px] top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow",
            "transition-transform",
            checked ? "translate-x-[14px]" : "translate-x-0",
          ].join(" ")}
        />
      </button>

      {/* Color dot */}
      <span
        className="w-2.5 h-2.5 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />

      {/* Label */}
      <span
        className={[
          "text-sm font-medium select-none cursor-pointer flex-1",
          checked ? "text-[#403770]" : "text-[#8A80A8]",
        ].join(" ")}
        onClick={() => onToggle(layer)}
      >
        {label}
      </span>

      {/* Count badge */}
      {isLoading ? (
        <span className="w-6 h-4 bg-[#E2DEEC] rounded-full animate-pulse" />
      ) : count !== undefined && checked ? (
        <span className="text-[10px] font-semibold text-[#8A80A8] bg-[#F7F5FA] rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
          {count > 999 ? `${Math.round(count / 1000)}k` : count}
        </span>
      ) : null}
    </div>
  );
}
