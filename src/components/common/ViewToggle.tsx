"use client";

// ViewToggle - A group of icon buttons to switch between views.
// Supports 2+ views via the generic views array prop.

import type { ReactNode } from "react";

export interface ViewOption {
  key: string;
  icon: ReactNode;
  label: string;
}

interface ViewToggleProps {
  view: string;
  onViewChange: (view: string) => void;
  views?: ViewOption[];
}

// Default cards + table views (backward-compatible)
const DEFAULT_VIEWS: ViewOption[] = [
  {
    key: "cards",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
        />
      </svg>
    ),
    label: "Grid view",
  },
  {
    key: "table",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 6h16M4 10h16M4 14h16M4 18h16"
        />
      </svg>
    ),
    label: "Table view",
  },
];

export default function ViewToggle({ view, onViewChange, views = DEFAULT_VIEWS }: ViewToggleProps) {
  const baseStyles = "p-1.5 transition-colors";
  const activeStyles = "bg-[#403770] text-white";
  const inactiveStyles = "bg-gray-100 text-gray-500 hover:bg-gray-200";

  return (
    <div className="inline-flex rounded-md" role="group">
      {views.map((v, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === views.length - 1;
        const roundingClass = isFirst && isLast
          ? "rounded-md"
          : isFirst
            ? "rounded-l-md"
            : isLast
              ? "rounded-r-md"
              : "";

        return (
          <button
            key={v.key}
            type="button"
            onClick={() => onViewChange(v.key)}
            className={`${baseStyles} ${roundingClass} ${view === v.key ? activeStyles : inactiveStyles}`}
            aria-label={v.label}
            aria-pressed={view === v.key}
          >
            {v.icon}
          </button>
        );
      })}
    </div>
  );
}
