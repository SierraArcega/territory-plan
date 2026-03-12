"use client";

import React from "react";

interface TruncatedTextProps {
  text: string;
  className?: string;
  as?: React.ElementType;
}

/**
 * Render text with CSS truncation and a native title tooltip.
 * The full text is shown on hover via the browser's built-in title tooltip.
 */
export function TruncatedText({
  text,
  className = "",
  as: Tag = "span",
}: TruncatedTextProps): React.ReactNode {
  return (
    <Tag className={`truncate block ${className}`} title={text}>
      {text}
    </Tag>
  );
}
