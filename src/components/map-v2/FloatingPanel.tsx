"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
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

  const panelWidth = panelMode === "collapsed" || panelMode === "hidden"
    ? "w-[56px]"
    : hasDistrictDetail
      ? "w-[65vw] max-w-[900px]"
      : rightPanelContent && isInPlanWorkspace
        ? "w-[50vw] max-w-[720px]"
        : "w-[33vw] min-w-[340px] max-w-[520px]";

  // Auto-collapse on tablet viewport
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const handler = (e: MediaQueryListEvent | MediaQueryList) => {
      if (e.matches) setPanelMode("collapsed");
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
              ${panelWidth} ${panelMode === "collapsed" ? "bottom-10" : hasDistrictDetail ? "bottom-10" : "bottom-[50%]"}
            `}
          >
            {/* Icon strip */}
            <IconBar />

            {/* Content area + optional right panel */}
            {panelMode === "full" && (
              <>
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
                  <PanelContent />
                </div>
                {isInPlanWorkspace && <RightPanel />}
              </>
            )}
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
        ) : panelMode !== "full" ? (
          /* Collapsed: floating bottom bar */
          <button
            onClick={() => setPanelMode("full")}
            className="absolute bottom-4 left-4 right-4 z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg px-4 py-3 flex items-center gap-3"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <circle cx="10" cy="10" r="7.5" stroke="#403770" strokeWidth="1.5" />
              <circle cx="10" cy="10" r="1.5" fill="#403770" />
              <path d="M10 4V6.5M10 13.5V16M4 10H6.5M13.5 10H16" stroke="#403770" strokeWidth="1.5" strokeLinecap="round" />
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
              onClick={() => setPanelMode("collapsed")}
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
