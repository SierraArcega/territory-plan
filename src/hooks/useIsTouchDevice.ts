"use client";

import { useState, useEffect } from "react";

/**
 * Hook to detect if the current device is a touch device.
 * Updates on mount and when the window receives a touchstart event.
 */
export function useIsTouchDevice(): boolean {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Check for touch capability
    const checkTouch = () => {
      const hasTouch =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE-specific
        navigator.msMaxTouchPoints > 0;
      setIsTouchDevice(hasTouch);
    };

    // Initial check
    checkTouch();

    // Also detect if user starts using touch
    const handleTouchStart = () => {
      setIsTouchDevice(true);
      // Remove listener after first touch detected
      window.removeEventListener("touchstart", handleTouchStart);
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
    };
  }, []);

  return isTouchDevice;
}
