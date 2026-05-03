"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "reports.chatCollapsed";

/**
 * Persists the user's chat-vs-collapsed-rail preference across reloads via
 * localStorage. Reads lazily on mount so SSR doesn't clash with the
 * client-only storage API.
 */
export function useChatCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw === "1") setCollapsedState(true);
    } catch {
      // localStorage unavailable (SSR, privacy mode, etc.) — fall back to
      // ephemeral state, which is the spec's worst-case behavior anyway.
    }
  }, []);

  const set = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore — see above
    }
  }, []);

  return [collapsed, set];
}
