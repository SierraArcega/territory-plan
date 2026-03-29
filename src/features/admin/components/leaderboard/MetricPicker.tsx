"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { Search } from "lucide-react";
import type { RegistryEntry } from "@/features/admin/lib/leaderboard-types";

interface MetricPickerProps {
  entries: RegistryEntry[];
  excludeActions: string[];
  onSelect: (entry: RegistryEntry) => void;
}

export default function MetricPicker({ entries, excludeActions, onSelect }: MetricPickerProps) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const available = useMemo(() => {
    const excluded = new Set(excludeActions);
    return entries.filter((e) => !excluded.has(e.action));
  }, [entries, excludeActions]);

  const filtered = useMemo(() => {
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter(
      (e) =>
        e.label.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
    );
  }, [available, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, RegistryEntry[]>();
    for (const entry of filtered) {
      const list = map.get(entry.category) ?? [];
      list.push(entry);
      map.set(entry.category, list);
    }
    return map;
  }, [filtered]);

  return (
    <div ref={ref} className="relative">
      <div
        className="flex items-center gap-2 px-3 py-2 border border-[#C2BBD4] rounded-lg cursor-text"
        onClick={() => setIsOpen(true)}
      >
        <Search className="w-4 h-4 text-[#A69DC0]" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={`Search ${available.length} available actions...`}
          className="flex-1 text-sm text-[#403770] placeholder-[#A69DC0] outline-none bg-transparent"
        />
      </div>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-[#D4CFE2] rounded-lg shadow-lg max-h-64 overflow-auto">
          {filtered.length === 0 ? (
            <p className="px-4 py-3 text-sm text-[#8A80A8]">No matching actions</p>
          ) : (
            Array.from(grouped.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="px-4 py-1.5 text-xs font-semibold text-[#8A80A8] bg-[#F7F5FA] uppercase tracking-wide">
                  {category}
                </div>
                {items.map((entry) => (
                  <button
                    key={entry.action}
                    onClick={() => {
                      onSelect(entry);
                      setSearch("");
                      setIsOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-[#EFEDF5] transition-colors"
                  >
                    <div className="text-sm font-medium text-[#403770]">{entry.label}</div>
                    <div className="text-xs text-[#8A80A8]">{entry.description}</div>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
