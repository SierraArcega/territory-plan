"use client";

import { useRef, useState, useEffect, type RefObject } from "react";

/**
 * Track the dimensions of an element via ResizeObserver.
 * Returns { ref, width, height }. Attach `ref` to the target element.
 */
export function useResizeObserver<T extends HTMLElement>(): {
  ref: RefObject<T | null>;
  width: number;
  height: number;
} {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setWidth(entry.contentRect.width);
        setHeight(entry.contentRect.height);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, width, height };
}
