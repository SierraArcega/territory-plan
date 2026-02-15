"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import IconBar from "./IconBar";
import PanelContent from "./PanelContent";

export default function FloatingPanel() {
  const panelCollapsed = useMapV2Store((s) => s.panelCollapsed);
  const setPanelCollapsed = useMapV2Store((s) => s.setPanelCollapsed);

  // Auto-collapse on tablet viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setPanelCollapsed(true);
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setPanelCollapsed]);

  return (
    <>
      {/* Desktop/Tablet: Floating left panel */}
      <div className="hidden sm:block">
        <div
          className={`
            absolute top-3 left-3 bottom-3 z-10
            bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
            flex flex-row overflow-hidden
            transition-all duration-300 ease-out
            panel-v2-enter
            ${panelCollapsed ? "w-[56px]" : "w-[340px]"}
          `}
        >
          {/* Icon strip */}
          <IconBar />

          {/* Content area */}
          {!panelCollapsed && (
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
              <PanelContent />
            </div>
          )}
        </div>
      </div>

      {/* Mobile: Bottom drawer */}
      <div className="sm:hidden">
        {/* Collapsed: floating bottom bar */}
        {panelCollapsed ? (
          <button
            onClick={() => setPanelCollapsed(false)}
            className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M2 10L10 14L18 10" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M2 6L10 10L18 6L10 2L2 6Z" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-sm font-medium text-gray-700">Explore Districts</span>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="ml-auto">
              <path d="M3 7.5L6 4.5L9 7.5" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        ) : (
          /* Expanded: bottom drawer */
          <>
            {/* Backdrop */}
            <div
              className="absolute inset-0 z-10 bg-black/20"
              onClick={() => setPanelCollapsed(true)}
            />
            <div className="absolute bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-sm rounded-t-2xl shadow-lg max-h-[70vh] flex flex-col">
              {/* Drag handle */}
              <div className="flex justify-center py-2">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="flex-1 overflow-hidden v2-scrollbar">
                <PanelContent />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
