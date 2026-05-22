"use client";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export function RankSortChip({
  value,
  onChange,
}: {
  value: "asc" | "desc" | null;
  onChange: (next: "asc" | "desc" | null) => void;
}) {
  const next = value === null ? "asc" : value === "asc" ? "desc" : null;
  const Icon = value === "desc" ? ArrowDown : value === "asc" ? ArrowUp : ArrowUpDown;
  const active = value !== null;
  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] whitespace-nowrap ${
        active
          ? "border-[#E2DEEC] bg-[#F7F5FA] text-[#403770]"
          : "border-dashed border-[#E2DEEC] text-[#544A78] hover:bg-[#F7F5FA]"
      }`}
    >
      <Icon className="h-3 w-3" />
      <span>Rank</span>
    </button>
  );
}
