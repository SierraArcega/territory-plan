"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  CATEGORY_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { useUsers, useProfile } from "@/features/shared/lib/queries";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

const CATEGORY_DOTS: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

export default function ActivitiesFilterRail() {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const { data: users } = useUsers();
  const { data: profile } = useProfile();

  function toggle<T extends string>(key: keyof typeof filters, value: T) {
    const current = (filters[key] as unknown as T[]) || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchFilters({ [key]: next } as Partial<typeof filters>);
  }

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-[#E2DEEC] flex-wrap">
      {/* Category dots */}
      <div className="inline-flex items-center gap-1 pr-2 border-r border-[#E2DEEC]">
        {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((cat) => {
          const active = filters.categories.includes(cat);
          const dim = filters.categories.length > 0 && !active;
          return (
            <button
              key={cat}
              type="button"
              title={CATEGORY_LABELS[cat]}
              aria-pressed={active}
              onClick={() => toggle("categories", cat)}
              className={`w-6 h-6 inline-flex items-center justify-center rounded-full transition-opacity ${
                dim ? "opacity-30" : "opacity-100"
              } hover:opacity-100`}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CATEGORY_DOTS[cat] }} />
            </button>
          );
        })}
      </div>

      <MultiSelectMenu
        label="Type"
        items={(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => ({
          value: t,
          label: ACTIVITY_TYPE_LABELS[t],
        }))}
        selected={filters.types}
        onChange={(next) => patchFilters({ types: next as ActivityType[] })}
      />

      <MultiSelectMenu
        label="Status"
        items={VALID_ACTIVITY_STATUSES.map((s) => ({
          value: s,
          label: ACTIVITY_STATUS_CONFIG[s].label,
          dot: ACTIVITY_STATUS_CONFIG[s].color,
        }))}
        selected={filters.statuses}
        onChange={(next) => patchFilters({ statuses: next })}
      />

      <MultiSelectMenu
        label="Owner"
        items={
          users?.map((u) => ({
            value: u.id,
            label: `${u.fullName || u.email}${profile?.id === u.id ? " (Me)" : ""}`,
          })) || []
        }
        selected={filters.owners}
        onChange={(next) => patchFilters({ owners: next })}
      />

      <div className="ml-auto flex items-center gap-2 min-w-[220px]">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0] pointer-events-none" />
          <input
            type="search"
            value={filters.text}
            onChange={(e) => patchFilters({ text: e.target.value })}
            placeholder="Search activities…"
            className="w-full pl-8 pr-2 py-1.5 text-sm border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent placeholder:text-[#A69DC0]"
          />
        </div>
      </div>
    </div>
  );
}

function MultiSelectMenu({
  label,
  items,
  selected,
  onChange,
}: {
  label: string;
  items: { value: string; label: string; dot?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  }

  const summary = selected.length === 0 ? label : `${label} · ${selected.length}`;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors ${
          selected.length > 0
            ? "bg-[#EEEAF5] border-[#C2BBD4] text-[#403770]"
            : "bg-white border-[#E2DEEC] text-[#6E6390] hover:bg-[#F7F5FA]"
        }`}
      >
        {summary}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[200px] max-h-64 overflow-auto bg-white border border-[#E2DEEC] rounded-lg shadow-lg p-1">
          {items.length === 0 ? (
            <div className="px-2 py-1.5 text-xs text-[#A69DC0]">No options</div>
          ) : (
            items.map((it) => {
              const active = selected.includes(it.value);
              return (
                <button
                  key={it.value}
                  type="button"
                  onClick={() => toggle(it.value)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-[#F7F5FA]"
                >
                  <span
                    className={`w-3 h-3 inline-flex items-center justify-center rounded-sm border ${
                      active ? "bg-[#403770] border-[#403770]" : "border-[#C2BBD4]"
                    }`}
                  >
                    {active && <span className="w-1.5 h-1.5 bg-white rounded-[1px]" />}
                  </span>
                  {it.dot && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: it.dot }} />}
                  <span className="text-[#403770]">{it.label}</span>
                </button>
              );
            })
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full mt-1 px-2 py-1 text-xs font-medium text-[#F37167] hover:bg-[#FEF2F1] rounded-md"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
