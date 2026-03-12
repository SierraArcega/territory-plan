"use client";

import { useCallback, useState, useEffect, useRef } from "react";

/**
 * Provides a scrollTo function for smooth scrolling to elements.
 * Accepts an HTMLElement or a CSS selector string.
 */
export function useScrollTo() {
  const scrollTo = useCallback(
    (
      target: HTMLElement | string,
      options?: { offset?: number; behavior?: ScrollBehavior },
    ) => {
      const el =
        typeof target === "string"
          ? document.querySelector<HTMLElement>(target)
          : target;

      if (!el) return;

      const offset = options?.offset ?? 0;
      const behavior = options?.behavior ?? "smooth";
      const top =
        el.getBoundingClientRect().top + window.scrollY - offset;

      window.scrollTo({ top, behavior });
    },
    [],
  );

  return { scrollTo };
}

/**
 * Track the current scroll position and scrolling state.
 * Updates are throttled to ~60fps via requestAnimationFrame.
 * `isScrolling` resets to false after 150ms of no scroll events.
 */
export function useScrollPosition() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isScrolling, setIsScrolling] = useState(false);
  const rafRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);

      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: window.scrollX, y: window.scrollY });
        setIsScrolling(true);

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setIsScrolling(false), 150);
      });
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return { ...position, isScrolling };
}
