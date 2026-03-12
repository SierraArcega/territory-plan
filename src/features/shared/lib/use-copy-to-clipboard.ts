"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { copyToClipboard } from "./copy";

/**
 * Hook for clipboard copy with auto-resetting status.
 * @param resetMs — time in ms before `copied` resets to false (default 2000)
 */
export function useCopyToClipboard(resetMs = 2000) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const copy = useCallback(
    async (text: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      try {
        const ok = await copyToClipboard(text);
        if (!ok) throw new Error("Clipboard write failed");
        setCopied(true);
        setError(null);
        timeoutRef.current = setTimeout(() => setCopied(false), resetMs);
      } catch (e) {
        setCopied(false);
        setError(e instanceof Error ? e : new Error(String(e)));
      }
    },
    [resetMs],
  );

  return { copy, copied, error };
}
