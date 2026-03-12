"use client";

import { useEffect, type RefObject } from "react";

/**
 * Call a callback when a click/touch occurs outside the referenced element.
 * @param ref — ref to the container element
 * @param callback — called on outside click
 * @param active — whether the listener is active (default true)
 */
export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  callback: () => void,
  active = true,
): void {
  useEffect(() => {
    if (!active) return;

    const handleEvent = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        callback();
      }
    };

    document.addEventListener("mousedown", handleEvent);
    document.addEventListener("touchstart", handleEvent);

    return () => {
      document.removeEventListener("mousedown", handleEvent);
      document.removeEventListener("touchstart", handleEvent);
    };
  }, [ref, callback, active]);
}
