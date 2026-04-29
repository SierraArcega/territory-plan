"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search } from "lucide-react";
import { useSearchContacts } from "@/features/activities/lib/queries";

interface ContactSearchInputProps {
  excludeContactIds: number[];
  districtLeaids: string[];
  onSelect: (contact: {
    id: number;
    name: string;
    title: string | null;
  }) => void;
}

export default function ContactSearchInput({
  excludeContactIds,
  districtLeaids,
  onSelect,
}: ContactSearchInputProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const firstLeaid = districtLeaids[0];
  const { data, isLoading } = useSearchContacts(debouncedQuery, firstLeaid);
  const results = data?.contacts ?? [];

  useEffect(() => {
    if (debouncedQuery.length >= 1 || firstLeaid) setShowDropdown(true);
    else setShowDropdown(false);
  }, [debouncedQuery, firstLeaid, results.length]);

  const handleSelect = useCallback(
    (contact: { id: number; name: string; title: string | null }) => {
      if (excludeContactIds.includes(contact.id)) return;
      onSelect(contact);
      setQuery("");
      setShowDropdown(false);
    },
    [excludeContactIds, onSelect]
  );

  const placeholder = firstLeaid
    ? "Search contacts in linked district…"
    : "Link a district first, or search by name…";

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (debouncedQuery.length >= 1 || firstLeaid) setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="w-full pl-8 pr-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
        {isLoading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-[#A69DC0] border-t-transparent rounded-full animate-spin" />
        )}
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-[#E2DEEC] rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.length === 0 && !isLoading ? (
            <div className="px-3 py-3 text-sm text-[#A69DC0] italic">
              No contacts found
            </div>
          ) : (
            results.slice(0, 8).map((c) => {
              const isExcluded = excludeContactIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    handleSelect({ id: c.id, name: c.name, title: c.title })
                  }
                  disabled={isExcluded}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    isExcluded
                      ? "text-[#C2BBD4] cursor-not-allowed bg-[#FAFAFA]"
                      : "text-[#403770] hover:bg-[#F7F5FA] cursor-pointer"
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  {c.title && (
                    <span className="text-[#A69DC0] ml-1">· {c.title}</span>
                  )}
                  {c.districtName && (
                    <div className="text-[11px] text-[#A69DC0] mt-0.5">
                      {c.districtName}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
