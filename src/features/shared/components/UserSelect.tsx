"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useUsers } from "@/lib/api";
import UserAvatar from "./UserAvatar";

interface UserSelectProps {
  /** User ids to hide from the list (already-added people). */
  excludeIds?: string[];
  onSelect: (userId: string) => void;
  /** Trigger button label. Default "+ Add". */
  label?: string;
  disabled?: boolean;
}

/**
 * Searchable single-select of users, rendered as a trigger button that opens a
 * dropdown with a search box. Picking a person fires onSelect and closes.
 * Never free-text — selection only (project preference for dropdowns).
 */
export default function UserSelect({
  excludeIds = [],
  onSelect,
  label = "+ Add",
  disabled,
}: UserSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const { data: users, isLoading } = useUsers();

  const handleOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
  }, []);

  useEffect(() => {
    if (open) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open, handleOutside]);

  const exclude = useMemo(() => new Set(excludeIds), [excludeIds]);
  const filtered = useMemo(() => {
    const list = (users ?? []).filter((u) => !exclude.has(u.id));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((u) => (u.fullName ?? u.email).toLowerCase().includes(q));
  }, [users, exclude, search]);

  const pick = (id: string) => {
    onSelect(id);
    setSearch("");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-[#F37167] hover:text-[#403770] font-medium disabled:opacity-50"
      >
        {open ? "Cancel" : label}
      </button>

      {open && (
        <div className="absolute z-30 top-full mt-1 right-0 w-64 max-w-[80vw] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search people..."
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#6EA3BE] focus:border-transparent"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {isLoading ? (
              <div className="px-3 py-2 text-sm text-[#A69DC0]">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-[#A69DC0] italic">
                {search.trim() ? "No matches" : "Everyone's added"}
              </div>
            ) : (
              filtered.map((u) => (
                <button
                  key={u.id}
                  onClick={() => pick(u.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left text-gray-700 hover:bg-[#F7F5FA] transition-colors"
                >
                  <UserAvatar name={u.fullName} avatarUrl={u.avatarUrl} size={22} />
                  <span className="truncate whitespace-nowrap">{u.fullName || u.email}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
