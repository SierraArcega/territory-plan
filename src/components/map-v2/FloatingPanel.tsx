"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import IconBar from "./IconBar";
import PanelContent from "./PanelContent";

export default function FloatingPanel() {
  const panelCollapsed = useMapV2Store((s) => s.panelCollapsed);

  return (
    <div
      className={`
        absolute top-3 left-3 bottom-3 z-10
        bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
        flex flex-row overflow-hidden
        transition-all duration-300 ease-out
        ${panelCollapsed ? "w-[56px]" : "w-[340px]"}
      `}
    >
      {/* Icon strip - always visible */}
      <IconBar />

      {/* Content area - hidden when collapsed */}
      {!panelCollapsed && (
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <PanelContent />
        </div>
      )}
    </div>
  );
}
