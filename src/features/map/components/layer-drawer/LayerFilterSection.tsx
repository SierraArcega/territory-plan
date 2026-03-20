"use client";

import { useState } from "react";

interface FilterOption {
  value: string;
  label: string;
}

interface LayerFilterSectionProps {
  label: string;
  expanded?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section within the layer drawer that reveals per-layer filters.
 */
export default function LayerFilterSection({
  label,
  expanded: initialExpanded = false,
  children,
}: LayerFilterSectionProps) {
  const [expanded, setExpanded] = useState(initialExpanded);

  return (
    <div className="border-t border-[#E2DEEC]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-medium text-[#8A80A8] uppercase tracking-wider hover:bg-[#F7F5FA] transition-colors"
      >
        {label}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-2">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Simple select dropdown for layer filters, matching the app's design tokens.
 */
export function FilterDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: FilterOption[];
  onChange: (value: string | null) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-[#A69DC0] mb-0.5">
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-lg bg-white text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      >
        <option value="">All</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
