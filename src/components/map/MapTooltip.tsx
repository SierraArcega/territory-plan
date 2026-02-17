"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMapStore, TooltipData } from "@/lib/store";
import { useIsTouchDevice } from "@/hooks/useIsTouchDevice";

interface MapTooltipProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export default function MapTooltip({ containerRef }: MapTooltipProps) {
  const { tooltip, hideTooltip, setTouchPreviewLeaid } = useMapStore();
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isExited, setIsExited] = useState(false);
  const isTouchDevice = useIsTouchDevice();

  // Calculate tooltip position relative to container, keeping it within bounds
  useEffect(() => {
    if (!tooltip.visible || !containerRef.current || !tooltipRef.current) return;

    const container = containerRef.current;
    const tooltipEl = tooltipRef.current;
    const containerRect = container.getBoundingClientRect();
    const tooltipRect = tooltipEl.getBoundingClientRect();

    // Offset from cursor
    const offsetX = 12;
    const offsetY = 12;

    // Calculate position relative to container
    let x = tooltip.x - containerRect.left + offsetX;
    let y = tooltip.y - containerRect.top + offsetY;

    // Keep tooltip within container bounds
    const maxX = containerRect.width - tooltipRect.width - 8;
    const maxY = containerRect.height - tooltipRect.height - 8;

    if (x > maxX) x = tooltip.x - containerRect.left - tooltipRect.width - offsetX;
    if (y > maxY) y = tooltip.y - containerRect.top - tooltipRect.height - offsetY;
    if (x < 8) x = 8;
    if (y < 8) y = 8;

    setPosition({ x, y });
  }, [tooltip.x, tooltip.y, tooltip.visible, containerRef]);

  // Handle exit animation completion
  useEffect(() => {
    if (tooltip.exiting) {
      // Wait for exit animation to complete (150ms delay + 100ms animation)
      const timer = setTimeout(() => {
        setIsExited(true);
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setIsExited(false);
    }
  }, [tooltip.exiting]);

  // Handle close button for touch devices
  const handleClose = useCallback(() => {
    hideTooltip();
    setTouchPreviewLeaid(null);
  }, [hideTooltip, setTouchPreviewLeaid]);

  // Don't render if not visible and exit animation is complete
  if ((!tooltip.visible && !tooltip.exiting) || isExited || !tooltip.data) {
    return null;
  }

  const animationClass = tooltip.exiting ? "tooltip-exit" : "tooltip-enter";

  return (
    <div
      ref={tooltipRef}
      className={`absolute z-50 pointer-events-none ${animationClass}`}
      style={{
        left: position.x,
        top: position.y,
        pointerEvents: isTouchDevice ? "auto" : "none",
      }}
      role="tooltip"
      aria-live="polite"
    >
      <div
        className="relative bg-white/95 backdrop-blur-sm rounded-lg px-4 py-3 min-w-[180px] max-w-[280px]"
        style={{
          boxShadow: "0 4px 20px rgba(64, 55, 112, 0.12)",
        }}
      >
        {/* Arrow pointer */}
        <div
          className="absolute -top-2 left-4 w-0 h-0"
          style={{
            borderLeft: "6px solid transparent",
            borderRight: "6px solid transparent",
            borderBottom: "8px solid rgba(255, 255, 255, 0.95)",
            filter: "drop-shadow(0 -2px 2px rgba(64, 55, 112, 0.05))",
          }}
        />

        {/* Close button for touch devices */}
        {isTouchDevice && (
          <button
            onClick={handleClose}
            className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors pointer-events-auto"
            aria-label="Close tooltip"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Content */}
        {tooltip.data.type === "state" ? (
          <StateTooltipContent data={tooltip.data} />
        ) : (
          <DistrictTooltipContent data={tooltip.data} isTouchDevice={isTouchDevice} />
        )}
      </div>
    </div>
  );
}

function StateTooltipContent({ data }: { data: TooltipData }) {
  return (
    <div>
      <div className="font-bold text-[#403770] text-base">
        {data.stateName || data.stateCode}
      </div>
      {data.districtCount !== undefined && (
        <div className="text-gray-500 text-sm mt-1">
          {data.districtCount.toLocaleString()} districts
        </div>
      )}
      <div className="text-gray-400 text-xs mt-2 flex items-center gap-1">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        Click to explore
      </div>
    </div>
  );
}

function DistrictTooltipContent({
  data,
  isTouchDevice,
}: {
  data: TooltipData;
  isTouchDevice: boolean;
}) {
  return (
    <div className={isTouchDevice ? "pr-6" : ""}>
      <div className="font-bold text-[#403770] text-base leading-tight">
        {data.name}
      </div>
      <div className="text-gray-500 text-sm mt-0.5">{data.stateAbbrev}</div>

      {/* Enrollment */}
      {data.enrollment !== undefined && data.enrollment > 0 && (
        <div className="text-gray-600 text-sm mt-2">
          {data.enrollment.toLocaleString()} students
        </div>
      )}

      {/* Charter school count */}
      {data.charterSchoolCount !== undefined && data.charterSchoolCount > 0 && (
        <div className="text-[#F37167] text-sm mt-1">
          {data.charterSchoolCount.toLocaleString()} charter school{data.charterSchoolCount !== 1 ? "s" : ""}
        </div>
      )}

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {data.tags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
              style={{ backgroundColor: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      )}

      {/* Sales executive */}
      {data.salesExecutive && (
        <div className="text-gray-500 text-xs mt-2 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          {data.salesExecutive}
        </div>
      )}

      {/* Tap hint for touch devices */}
      {isTouchDevice && (
        <div className="text-gray-400 text-xs mt-2 flex items-center gap-1">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 22v-5" />
            <path d="M9 8V2" />
            <path d="M15 8V2" />
            <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
          </svg>
          Tap again to select
        </div>
      )}
    </div>
  );
}
