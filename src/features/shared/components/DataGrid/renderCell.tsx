// src/features/shared/components/DataGrid/renderCell.tsx
"use client";

import type { ReactNode } from "react";
import type { ColumnDef } from "./types";

const PERCENT_KEYS = /percent|rate|proficiency/i;

function renderColoredPills(items: { name: string; color: string }[]) {
  if (items.length === 0) return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {items.map((item, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium leading-tight"
          style={{
            backgroundColor: item.color + "18",
            color: item.color,
            border: `1px solid ${item.color}30`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          {item.name}
        </span>
      ))}
    </span>
  );
}

/**
 * Determines if a column represents currency based on its label or key.
 * No global state needed — derive from the column definition directly.
 */
function isCurrencyColumn(key: string, columnDef?: ColumnDef): boolean {
  if (key.startsWith("comp_")) return true;
  return columnDef?.label.includes("($)") ?? false;
}

export function formatCellValue(value: unknown, key: string, columnDef?: ColumnDef): string {
  if (value == null) return "\u2014";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    if (value.length === 0) return "\u2014";
    return value
      .map((item) =>
        typeof item === "object" && item !== null && "name" in item
          ? (item as { name: string }).name
          : String(item)
      )
      .join(", ");
  }
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try { return new Date(value).toLocaleDateString(); }
    catch { return value; }
  }
  if (typeof value === "number") {
    if (PERCENT_KEYS.test(key)) return `${(value * 100).toFixed(1)}%`;
    if (isCurrencyColumn(key, columnDef)) {
      const rounded = Math.round(value);
      if (Math.abs(rounded) >= 1_000_000) return `$${(rounded / 1_000_000).toFixed(1)}M`;
      if (Math.abs(rounded) >= 1_000) return `$${(rounded / 1_000).toFixed(1)}K`;
      return `$${rounded.toLocaleString()}`;
    }
    return value.toLocaleString();
  }
  return String(value);
}

export function renderCell(value: unknown, key: string, columnDef?: ColumnDef): ReactNode {
  if (value == null) return <span className="text-[#A69DC0]">{"\u2014"}</span>;

  // Array of objects with name + color → colored pills
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    typeof value[0] === "object" &&
    value[0] !== null &&
    "name" in value[0] &&
    "color" in value[0]
  ) {
    return renderColoredPills(value as { name: string; color: string }[]);
  }

  const formatted = formatCellValue(value, key, columnDef);
  if (formatted === "\u2014") return <span className="text-[#A69DC0]">{"\u2014"}</span>;
  return <>{formatted}</>;
}
