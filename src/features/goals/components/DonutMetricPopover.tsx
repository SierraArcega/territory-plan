"use client";

import { useEffect, useRef } from "react";
import { formatCurrency } from "@/features/shared/lib/format";

interface DonutMetricPopoverProps {
  label: string;          // "Earnings", "Take", etc.
  current: number;
  target: number | null;
  format: "currency" | "number";
  color: string;
  onClose: () => void;
}

export default function DonutMetricPopover({
  label,
  current,
  target,
  format,
  color,
  onClose,
}: DonutMetricPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Dismiss on click-outside
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const currentFmt =
    format === "currency"
      ? formatCurrency(current, true)
      : current.toLocaleString();
  const targetFmt =
    target !== null && target !== undefined
      ? format === "currency"
        ? formatCurrency(target, true)
        : target.toLocaleString()
      : "-";

  return (
    <div
      ref={popoverRef}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
      data-testid="donut-popover"
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-100 px-3 py-2 whitespace-nowrap">
        <p className="text-[11px] font-bold" style={{ color }}>
          {label}
        </p>
        <p className="text-sm font-semibold text-[#403770]">{currentFmt}</p>
        <p className="text-[10px] text-gray-400">of {targetFmt}</p>
      </div>
    </div>
  );
}
