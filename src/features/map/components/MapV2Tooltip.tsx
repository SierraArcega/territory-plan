"use client";

import { useEffect, forwardRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { TRANSITION_BUCKET_MAP } from "@/features/map/lib/comparison";

const CATEGORY_LABELS: Record<string, string> = {
  multi_year_growing: "Multi-year (Growing)",
  multi_year_flat: "Multi-year (Flat)",
  multi_year_shrinking: "Multi-year (Shrinking)",
  new: "New this year",
  lapsed: "Lapsed customer",
  churned: "Churned",
  pipeline: "In pipeline",
  target: "Target",
  new_business_pipeline: "New Business Pipeline",
  winback_pipeline: "Winback Pipeline",
  renewal_pipeline: "Renewal Pipeline",
  expansion_pipeline: "Expansion Pipeline",
};

const CATEGORY_COLORS: Record<string, string> = {
  multi_year_growing: "#a6c9da",
  multi_year_flat: "#6EA3BE",
  multi_year_shrinking: "#8bb5cb",
  new: "#a6c9da",
  lapsed: "#FFB347",
  pipeline: "#c4dae6",
  target: "#e8f1f5",
};

const SCHOOL_LEVEL_LABELS: Record<number, string> = {
  1: "Elementary",
  2: "Middle",
  3: "High",
  4: "Other",
};

const SCHOOL_LEVEL_COLORS: Record<number, string> = {
  1: "#3B82F6",
  2: "#10B981",
  3: "#F59E0B",
  4: "#6B7280",
};

const MapV2Tooltip = forwardRef<HTMLDivElement>(function MapV2Tooltip(_, ref) {
  const tooltip = useMapV2Store((s) => s.tooltip);
  const compareMode = useMapV2Store((s) => s.compareMode);
  const compareView = useMapV2Store((s) => s.compareView);
  const compareFyA = useMapV2Store((s) => s.compareFyA);
  const compareFyB = useMapV2Store((s) => s.compareFyB);

  // Handle exit animation cleanup
  useEffect(() => {
    if (tooltip.exiting) {
      const timer = setTimeout(() => {
        useMapV2Store.setState({
          tooltip: { visible: false, exiting: false, x: 0, y: 0, data: null },
        });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [tooltip.exiting]);

  if (!tooltip.visible && !tooltip.exiting) return null;
  if (!tooltip.data) return null;

  const { data } = tooltip;

  return (
    <div
      ref={ref}
      className={`
        absolute pointer-events-none z-[15]
        bg-white/95 backdrop-blur-sm rounded-xl shadow-lg
        px-3 py-2 max-w-[220px]
        ${tooltip.exiting ? "tooltip-exit" : "tooltip-enter"}
      `}
      style={{
        left: tooltip.x + 12,
        top: tooltip.y - 8,
        transform: "translateY(-100%)",
      }}
    >
      {data.type === "state" && (
        <>
          <div className="text-sm font-medium text-gray-800">{data.stateName}</div>
          <div className="text-xs text-gray-400">Click to explore</div>
        </>
      )}

      {data.type === "district" && (
        <>
          <div className="text-sm font-medium text-gray-800 leading-tight">
            {data.name}
          </div>
          {data.stateAbbrev && (
            <div className="text-xs text-gray-400">{data.stateAbbrev}</div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {data.enrollment && (
              <span className="text-xs text-gray-500">
                {data.enrollment.toLocaleString()} students
              </span>
            )}
          </div>

          {/* Compare mode: changes view -- show both FY categories + transition bucket */}
          {compareMode && compareView === "changes" && data.transitionBucket ? (
            <>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-[10px] text-gray-400 w-8 shrink-0">
                  {compareFyA.replace("fy", "FY")}:
                </span>
                <span className="text-xs text-gray-500">
                  {data.customerCategoryA
                    ? (CATEGORY_LABELS[data.customerCategoryA] || data.customerCategoryA)
                    : "None"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] text-gray-400 w-8 shrink-0">
                  {compareFyB.replace("fy", "FY")}:
                </span>
                <span className="text-xs text-gray-500">
                  {data.customerCategoryB
                    ? (CATEGORY_LABELS[data.customerCategoryB] || data.customerCategoryB)
                    : "None"}
                </span>
              </div>
              {/* Transition bucket */}
              <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-gray-100">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: data.transitionBucket === "unchanged"
                      ? "transparent"
                      : TRANSITION_BUCKET_MAP[data.transitionBucket].color,
                    border: data.transitionBucket === "unchanged"
                      ? `1.5px solid ${TRANSITION_BUCKET_MAP[data.transitionBucket].color}`
                      : "none",
                  }}
                />
                <span className="text-xs font-medium text-gray-600">
                  {TRANSITION_BUCKET_MAP[data.transitionBucket].label}
                </span>
              </div>
            </>
          ) : (
            /* Normal mode (and side-by-side): show single category */
            data.customerCategory && (
              <div className="flex items-center gap-1.5 mt-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: CATEGORY_COLORS[data.customerCategory] || "#9CA3AF",
                  }}
                />
                <span className="text-xs text-gray-500">
                  {CATEGORY_LABELS[data.customerCategory] || data.customerCategory}
                </span>
              </div>
            )
          )}
        </>
      )}

      {data.type === "school" && (
        <>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: SCHOOL_LEVEL_COLORS[data.schoolLevel ?? 4] || "#6B7280" }}
            />
            <div className="text-sm font-medium text-gray-800 leading-tight">
              {data.name}
            </div>
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {SCHOOL_LEVEL_LABELS[data.schoolLevel ?? 4] || "School"}
            {data.lograde && data.higrade ? ` · ${data.lograde}–${data.higrade}` : ""}
          </div>
          {data.enrollment != null && data.enrollment > 0 && (
            <div className="text-xs text-gray-500 mt-0.5">
              {data.enrollment.toLocaleString()} students
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default MapV2Tooltip;
