"use client";

import React from "react";

interface HighlightProps {
  text: string;
  query: string;
  className?: string;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Highlight matching substrings within text.
 * Uses Robin's Egg background + Plum text from Fullmind brand tokens.
 */
export function Highlight({ text, query, className }: HighlightProps): React.ReactNode {
  if (!query.trim()) {
    return <span className={className}>{text}</span>;
  }

  const regex = new RegExp(`(${escapeRegex(query)})`, "gi");
  const parts = text.split(regex);

  if (parts.length === 1) {
    return <span className={className}>{text}</span>;
  }

  // String.split with a capturing group puts matches at odd indices
  return (
    <span className={className}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark
            key={i}
            className="bg-[#C4E7E6] text-[#403770] rounded-sm px-0.5"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </span>
  );
}
