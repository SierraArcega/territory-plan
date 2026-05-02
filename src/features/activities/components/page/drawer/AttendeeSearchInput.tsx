"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search } from "lucide-react";
import { useUsers } from "@/features/shared/lib/queries";

interface AttendeeSearchInputProps {
  excludeUserIds: string[];
  onSelect: (user: { id: string; fullName: string | null; email: string }) => void;
}

export default function AttendeeSearchInput({
  excludeUserIds,
  onSelect,
}: AttendeeSearchInputProps) {
  const [query, setQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: users } = useUsers();

  useEffect(() => {
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = users ?? [];
    if (!q) return all;
    return all.filter((u) => {
      const name = (u.fullName || "").toLowerCase();
      return name.includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [users, query]);

  const handleSelect = useCallback(
    (user: { id: string; fullName: string | null; email: string }) => {
      if (excludeUserIds.includes(user.id)) return;
      onSelect(user);
      setQuery("");
      setShowDropdown(false);
    },
    [excludeUserIds, onSelect]
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(true)}
          placeholder="Add a teammate…"
          className="w-full pl-8 pr-3 py-2 border border-[#C2BBD4] rounded-lg text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-[#E2DEEC] rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-sm text-[#A69DC0] italic">
              No teammates found
            </div>
          ) : (
            filtered.slice(0, 8).map((u) => {
              const isExcluded = excludeUserIds.includes(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() =>
                    handleSelect({
                      id: u.id,
                      fullName: u.fullName,
                      email: u.email,
                    })
                  }
                  disabled={isExcluded}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    isExcluded
                      ? "text-[#C2BBD4] cursor-not-allowed bg-[#FAFAFA]"
                      : "text-[#403770] hover:bg-[#F7F5FA] cursor-pointer"
                  }`}
                >
                  <span className="font-medium">{u.fullName || u.email}</span>
                  {u.fullName && (
                    <span className="text-[#A69DC0] ml-1 text-[11px]">
                      · {u.email}
                    </span>
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
