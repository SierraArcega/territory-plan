"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import IconBar from "./IconBar";
import PanelContent from "./PanelContent";
import RightPanel from "./RightPanel";

export default function FloatingPanel() {
  const panelMode = useMapV2Store((s) => s.panelMode);
  const setPanelMode = useMapV2Store((s) => s.setPanelMode);
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
  const panelState = useMapV2Store((s) => s.panelState);

  const isInPlanWorkspace =
    panelState === "PLAN_OVERVIEW" ||
    panelState === "PLAN_ACTIVITIES" ||
    panelState === "PLAN_TASKS" ||
    panelState === "PLAN_CONTACTS" ||
    panelState === "PLAN_PERF";

  const hasDistrictDetail =
    rightPanelContent?.type === "district_card" && isInPlanWorkspace;

  const panelWidth = hasDistrictDetail
    ? "w-[65vw] max-w-[900px]"
    : rightPanelContent && isInPlanWorkspace
      ? "w-[50vw] max-w-[720px]"
      : "w-[33vw] min-w-[340px] max-w-[520px]";

  // Auto-collapse on tablet viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setPanelMode("hidden");
    };
    handler(mq);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [setPanelMode]);

  return (
    <>
      {/* Desktop/Tablet: Floating left panel */}
      <div className="hidden sm:block">
        {panelMode === "hidden" ? (
          <button
            onClick={() => setPanelMode("full")}
            className="absolute top-10 left-12 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 hover:shadow-xl transition-all duration-150 group animate-in fade-in duration-200"
            aria-label="Show panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400 group-hover:text-plum transition-colors">
              <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-gray-500 group-hover:text-plum transition-colors">Menu</span>
          </button>
        ) : (
          <div
            className={`
              absolute top-10 left-12 z-10
              bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
              flex flex-row overflow-hidden
              transition-all duration-300 ease-out
              panel-v2-enter
              ${panelWidth} ${hasDistrictDetail ? "bottom-10" : "bottom-[50%]"}
            `}
          >
            {/* Icon strip */}
            <IconBar />

            {/* Content area + optional right panel */}
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
              <PanelContent />
            </div>
            {isInPlanWorkspace && <RightPanel />}
          </div>
        )}
      </div>

      {/* Mobile: Bottom drawer */}
      <div className="sm:hidden">
        {panelMode === "hidden" ? (
          <button
            onClick={() => setPanelMode("full")}
            className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60"
            aria-label="Show panel"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
              <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span className="text-sm font-medium text-gray-500">Menu</span>
          </button>
        ) : (
          /* Expanded: bottom drawer */
          <>
            {/* Backdrop */}
            <div
              className="absolute inset-0 z-10 bg-black/20"
              onClick={() => setPanelMode("hidden")}
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
