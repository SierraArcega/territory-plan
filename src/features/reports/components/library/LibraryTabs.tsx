"use client";

import { Search, Star } from "lucide-react";

export type LibraryTab = "mine" | "starred" | "team";

interface Props {
  tab: LibraryTab;
  counts: { mine: number; starred: number; team: number };
  searchQuery: string;
  onTabChange: (next: LibraryTab) => void;
  onSearchChange: (next: string) => void;
}

const TABS: Array<{ id: LibraryTab; label: string }> = [
  { id: "mine", label: "Mine" },
  { id: "starred", label: "Starred" },
  { id: "team", label: "Team" },
];

export function LibraryTabs({ tab, counts, searchQuery, onTabChange, onSearchChange }: Props) {
  return (
    <div className="mb-3.5 flex flex-wrap items-end justify-between gap-3 border-b border-[#E2DEEC]">
      <div className="flex items-center -mb-px">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className="inline-flex items-center gap-1.5 border-b-2 bg-transparent px-3.5 py-2.5 text-[13px] transition-colors"
              style={{
                borderColor: active ? "#403770" : "transparent",
                color: active ? "#403770" : "#8A80A8",
                fontWeight: active ? 600 : 500,
              }}
            >
              {t.id === "starred" && (
                <Star size={11} fill="#FFCF70" color="#FFCF70" className="shrink-0" />
              )}
              <span className="whitespace-nowrap">{t.label}</span>
              <span className="text-[10.5px] font-medium tabular-nums text-[#A69DC0]">
                {counts[t.id]}
              </span>
            </button>
          );
        })}
      </div>
      <div className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-2.5 py-1.5">
        <Search size={12} className="shrink-0 text-[#A69DC0]" />
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by title…"
          className="w-[200px] border-none bg-transparent text-xs text-[#403770] outline-none placeholder:text-[#A69DC0]"
        />
      </div>
    </div>
  );
}
