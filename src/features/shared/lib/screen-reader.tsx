"use client";

import React, { type ElementType } from "react";

const SR_ONLY_STYLES: React.CSSProperties = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
};

/**
 * Raw class string for Tailwind's sr-only pattern.
 * Use this when you need sr-only without the component wrapper.
 */
export const srOnlyClass = "sr-only";

interface ScreenReaderOnlyProps {
  children: React.ReactNode;
  as?: ElementType;
}

/**
 * Visually hide content while keeping it accessible to screen readers.
 * Uses the standard clip-rect technique.
 */
export function ScreenReaderOnly({
  children,
  as: Tag = "span",
}: ScreenReaderOnlyProps): React.ReactNode {
  return <Tag style={SR_ONLY_STYLES}>{children}</Tag>;
}
