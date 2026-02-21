"use client";

import { useState, useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";

interface TileLoadingIndicatorProps {
  map: maplibregl.Map | null;
}

export default function TileLoadingIndicator({ map }: TileLoadingIndicatorProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const loadingCountRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!map) return;

    const handleSourceDataLoading = () => {
      loadingCountRef.current++;
      // Clear any pending exit
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsExiting(false);
      setIsLoading(true);
    };

    const handleSourceData = () => {
      loadingCountRef.current = Math.max(0, loadingCountRef.current - 1);

      // Debounce the hide to prevent flickering
      if (loadingCountRef.current === 0) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          setIsExiting(true);
          // Wait for exit animation to complete
          setTimeout(() => {
            setIsLoading(false);
            setIsExiting(false);
          }, 200);
        }, 100);
      }
    };

    const handleIdle = () => {
      loadingCountRef.current = 0;
      if (isLoading) {
        setIsExiting(true);
        setTimeout(() => {
          setIsLoading(false);
          setIsExiting(false);
        }, 200);
      }
    };

    map.on("sourcedataloading", handleSourceDataLoading);
    map.on("sourcedata", handleSourceData);
    map.on("idle", handleIdle);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      map.off("sourcedataloading", handleSourceDataLoading);
      map.off("sourcedata", handleSourceData);
      map.off("idle", handleIdle);
    };
  }, [map, isLoading]);

  if (!isLoading) return null;

  const animationClass = isExiting ? "tile-loading-exit" : "tile-loading-enter";

  return (
    <div
      className={`absolute bottom-4 right-4 z-10 ${animationClass}`}
      role="status"
      aria-live="polite"
      aria-label="Loading map tiles"
    >
      <div
        className="flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-lg"
        style={{
          boxShadow: "0 4px 12px rgba(64, 55, 112, 0.1)",
        }}
      >
        {/* Spinner */}
        <svg
          className="tile-loading-spinner w-4 h-4 text-[#403770]"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
        <span className="text-xs font-medium text-[#403770]">Loading...</span>
      </div>
    </div>
  );
}
