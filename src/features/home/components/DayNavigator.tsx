"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// ============================================================================
// DayNavigator — date header with prev/next arrows
// ============================================================================

interface DayNavigatorProps {
  selectedDate: string; // YYYY-MM-DD or "no-due-date"
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}

function formatDateHeader(dateStr: string): string {
  if (dateStr === "no-due-date") return "No Due Date";
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default function DayNavigator({
  selectedDate,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: DayNavigatorProps) {
  return (
    <div className="flex items-center justify-between">
      <button
        onClick={onPrev}
        disabled={!hasPrev}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none ${
          hasPrev
            ? "text-[#403770] hover:bg-[#F7F5FA]"
            : "text-[#A69DC0] cursor-not-allowed opacity-50"
        }`}
        aria-label="Previous day"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <h2 className="text-sm font-semibold text-[#403770]">
        {formatDateHeader(selectedDate)}
      </h2>

      <button
        onClick={onNext}
        disabled={!hasNext}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none ${
          hasNext
            ? "text-[#403770] hover:bg-[#F7F5FA]"
            : "text-[#A69DC0] cursor-not-allowed opacity-50"
        }`}
        aria-label="Next day"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
