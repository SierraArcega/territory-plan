"use client";

import { useState, useEffect } from "react";
import { Search, Square, SquareCheck } from "lucide-react";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";
import { useSearchContacts } from "@/features/activities/lib/queries";
import { cn } from "@/features/shared/lib/cn";

export default function ContactFilter({ onClose }: { onClose: () => void }) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useSearchContacts(debounced);

  function toggle(id: number) {
    const next = filters.contactIds.includes(id)
      ? filters.contactIds.filter((v) => v !== id)
      : [...filters.contactIds, id];
    patchFilters({ contactIds: next });
  }

  return (
    <div className="p-1 w-72 max-h-96 overflow-y-auto">
      <div className="px-1 pt-1 pb-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts…"
            className="w-full pl-7 pr-2 py-1.5 text-xs text-[#403770] placeholder:text-[#A69DC0] border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#F37167]"
          />
        </div>
      </div>
      {isLoading ? (
        <div className="px-3 py-2 text-[11px] text-[#A69DC0] italic">Loading…</div>
      ) : (data?.contacts ?? []).length === 0 ? (
        <div className="px-3 py-2 text-[11px] text-[#A69DC0] italic">
          {debounced ? "No contacts match." : "Type to search…"}
        </div>
      ) : (
        (data?.contacts ?? []).map((c) => {
          const active = filters.contactIds.includes(c.id);
          const Box = active ? SquareCheck : Square;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              aria-pressed={active}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
                active ? "bg-[#F7F5FA] text-[#403770]" : "text-[#403770] hover:bg-[#F7F5FA]"
              )}
            >
              <Box className={cn("w-3.5 h-3.5 flex-shrink-0", active ? "text-[#403770]" : "text-[#A69DC0]")} />
              <span className="flex-1 truncate">
                {c.name}
                {c.title && <span className="text-[10px] text-[#A69DC0] ml-1">{c.title}</span>}
              </span>
            </button>
          );
        })
      )}
      <div className="flex items-center justify-between border-t border-[#EFEDF5] mt-1 pt-1.5 px-1">
        <button
          type="button"
          onClick={() => patchFilters({ contactIds: [] })}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#8A80A8] hover:text-[#F37167]"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={onClose}
          className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[#544A78] hover:text-[#403770]"
        >
          Done
        </button>
      </div>
    </div>
  );
}
