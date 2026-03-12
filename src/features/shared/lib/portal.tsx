"use client";

import { createPortal } from "react-dom";
import React, { useState, useEffect } from "react";

interface PortalProps {
  children: React.ReactNode;
  container?: Element;
}

/**
 * Render children into a DOM node outside the parent component tree.
 * Defaults to document.body. SSR-safe (returns null on server).
 */
export function Portal({ children, container }: PortalProps): React.ReactNode {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return createPortal(children, container ?? document.body);
}
