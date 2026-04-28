"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Filter, RotateCcw, Search, X } from "lucide-react";
import {
  CATEGORY_LABELS,
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  ACTIVITY_CATEGORIES,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { useUsers, useProfile, useTags } from "@/features/shared/lib/queries";
import { useStates } from "@/features/map/lib/queries";
import { useTerritoryPlans } from "@/features/plans/lib/queries";
import { useActivitiesChrome, EMPTY_FILTERS, type DealKind } from "@/features/activities/lib/filters-store";
import { cn } from "@/features/shared/lib/cn";

const CATEGORY_DOTS: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

interface DealKindMeta {
  id: DealKind;
  label: string;
  color: string;
  glyph: string;
}

const DEAL_KINDS: DealKindMeta[] = [
  { id: "won", label: "Won", color: "#69B34A", glyph: "↗" },
  { id: "lost", label: "Lost", color: "#F37167", glyph: "↘" },
  { id: "created", label: "New", color: "#6EA3BE", glyph: "+" },
  { id: "progressed", label: "Progressed", color: "#403770", glyph: "→" },
  { id: "closing", label: "Closing", color: "#9B7BC4", glyph: "◎" },
];

interface ActivitiesFilterRailProps {
  /** Opens the ⌘K CommandBar overlay. */
  onOpenCommandBar?: () => void;
}

export default function ActivitiesFilterRail({ onOpenCommandBar }: ActivitiesFilterRailProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const resetFilters = useActivitiesChrome((s) => s.resetFilters);
  const { data: users } = useUsers();
  const { data: profile } = useProfile();
  const { data: states } = useStates({ enabled: true });
  const { data: territories } = useTerritoryPlans({ enabled: true });
  const { data: tags } = useTags();

  // Solo-toggle helper for category chips: double-click → only this category.
  const dblClickGuard = useRef<{ key: string; t: number }>({ key: "", t: 0 });

  const allCategories = useMemo(
    () => Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[],
    []
  );

  function toggleArr<T extends string>(key: keyof typeof filters, value: T) {
    const current = (filters[key] as unknown as T[]) || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchFilters({ [key]: next } as Partial<typeof filters>);
  }

  function soloArr<T extends string>(key: keyof typeof filters, value: T) {
    patchFilters({ [key]: [value] } as Partial<typeof filters>);
  }

  function handleCategoryClick(cat: ActivityCategory) {
    const now = Date.now();
    const last = dblClickGuard.current;
    if (last.key === cat && now - last.t < 350) {
      // double-click → solo
      dblClickGuard.current = { key: "", t: 0 };
      soloArr<ActivityCategory>("categories", cat);
      return;
    }
    dblClickGuard.current = { key: cat, t: now };
    toggleArr<ActivityCategory>("categories", cat);
  }

  const stateItems = useMemo(
    () =>
      (states ?? []).map((s) => ({
        value: s.abbrev,
        label: `${s.name} (${s.abbrev})`,
      })),
    [states]
  );
  const territoryItems = useMemo(
    () =>
      (territories ?? []).map((t) => ({
        value: t.id,
        label: t.name,
        dot: t.color,
      })),
    [territories]
  );
  const tagItems = useMemo(
    () =>
      (tags ?? []).map((t) => ({
        value: String(t.id),
        label: t.name,
        dot: t.color,
      })),
    [tags]
  );

  // Partial count: how many groups have an active (non-default) selection?
  const anyPartial =
    filters.categories.length > 0 ||
    filters.types.length > 0 ||
    filters.dealKinds.length > 0 ||
    filters.statuses.length > 0 ||
    filters.owners.length > 0 ||
    filters.states.length > 0 ||
    filters.territories.length > 0 ||
    filters.tags.length > 0 ||
    filters.text.trim().length > 0;

  return (
    <>
      {/* Mobile-only filter trigger */}
      <div className="md:hidden flex items-center gap-2 px-4 py-2 bg-white border-b border-[#E2DEEC]">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label={anyPartial ? "Open filters (filters active)" : "Open filters"}
          className="fm-focus-ring inline-flex items-center gap-1.5 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors"
        >
          <Filter className="w-3.5 h-3.5 text-[#8A80A8]" />
          Filters
          {anyPartial && (
            <span
              aria-hidden
              className="ml-0.5 inline-block w-1.5 h-1.5 rounded-full bg-[#F37167]"
            />
          )}
        </button>
      </div>

      <div
        className={cn(
          mobileOpen
            ? "fixed inset-0 z-50 bg-white p-4 overflow-y-auto flex flex-col items-stretch gap-3"
            : "hidden md:flex items-center gap-2 px-6 py-2.5 bg-white border-b border-[#E2DEEC] flex-wrap"
        )}
      >
        {mobileOpen && (
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-[#403770]">Filters</span>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close filters"
              className="fm-focus-ring p-1 rounded-md hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors"
            >
              <X className="w-4 h-4 text-[#544A78]" />
            </button>
          </div>
        )}
      {/* ⌘K command bar trigger */}
      <button
        type="button"
        onClick={onOpenCommandBar}
        className="inline-flex items-center gap-2 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <Search className="w-3.5 h-3.5 text-[#8A80A8]" />
        <span className="text-[#8A80A8]">Search or filter…</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#544A78] bg-[#EFEDF5] border border-[#E2DEEC] rounded">
          ⌘K
        </kbd>
      </button>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      {/* Categories chip group */}
      <FilterGroupLabel
        label="Activities"
        count={filters.categories.length}
        total={allCategories.length}
      />
      <div className="inline-flex items-center gap-1 flex-wrap">
        {allCategories.map((cat) => {
          const active = filters.categories.includes(cat);
          const dim = filters.categories.length > 0 && !active;
          return (
            <CategoryChip
              key={cat}
              label={CATEGORY_LABELS[cat]}
              color={CATEGORY_DOTS[cat]}
              active={active}
              dim={dim}
              onClick={() => handleCategoryClick(cat)}
            />
          );
        })}
      </div>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      {/* Deals chip group */}
      <FilterGroupLabel
        label="Deals"
        count={filters.dealKinds.length}
        total={DEAL_KINDS.length}
      />
      <div className="inline-flex items-center gap-1 flex-wrap">
        {DEAL_KINDS.map((d) => (
          <DealKindChip
            key={d.id}
            meta={d}
            active={filters.dealKinds.includes(d.id)}
            dim={filters.dealKinds.length > 0 && !filters.dealKinds.includes(d.id)}
            onClick={() => toggleArr<DealKind>("dealKinds", d.id)}
          />
        ))}
      </div>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      {/* Multi-select dropdowns: Type / Status / Owner / State / Territory / Tags */}
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

      <MultiSelectMenu
        label="State"
        items={stateItems}
        selected={filters.states}
        onChange={(next) => patchFilters({ states: next })}
        searchable
      />

      <MultiSelectMenu
        label="Territory"
        items={territoryItems}
        selected={filters.territories}
        onChange={(next) => patchFilters({ territories: next })}
        searchable
      />

      <MultiSelectMenu
        label="Tags"
        items={tagItems}
        selected={filters.tags}
        onChange={(next) => patchFilters({ tags: next })}
        searchable
      />

      <div className="ml-auto flex items-center gap-2">
        {anyPartial && (
          <button
            type="button"
            onClick={() => {
              resetFilters();
              if (profile?.id) {
                // Re-seed default owner so reset returns to "My activities"
                // rather than team scope.
                patchFilters({ ...EMPTY_FILTERS, owners: [profile.id] });
              }
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
          >
            <RotateCcw className="w-3 h-3" />
            Reset filters
          </button>
        )}
      </div>
      </div>
    </>
  );
}

function FilterGroupLabel({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const partial = count > 0 && count < total;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.08em]",
        partial ? "text-[#403770]" : "text-[#8A80A8]"
      )}
    >
      {label}
      {partial && (
        <span className="inline-flex items-center justify-center min-w-[16px] h-3.5 px-1 text-[9px] font-extrabold text-white bg-[#403770] rounded-full tabular-nums">
          {count}/{total}
        </span>
      )}
    </span>
  );
}

function CategoryChip({
  label,
  color,
  active,
  dim,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      title="Double-click to filter to only this category"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
        "rounded-full border transition-colors duration-[120ms] ease-out",
        "fm-focus-ring",
        active
          ? "bg-white border-[var(--cat-color)] text-[#403770] font-semibold"
          : "bg-[#F7F5FA] border-[#D4CFE2] text-[#8A80A8] hover:bg-white",
        dim && "opacity-55"
      )}
      style={{ "--cat-color": color } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className="w-2 h-2 rounded-sm"
        style={{ backgroundColor: color, opacity: active ? 1 : 0.6 }}
      />
      {label}
    </button>
  );
}

function DealKindChip({
  meta,
  active,
  dim,
  onClick,
}: {
  meta: DealKindMeta;
  active: boolean;
  dim: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
        "rounded-full border transition-colors duration-[120ms] ease-out",
        "fm-focus-ring",
        active
          ? "bg-white border-[var(--dk-color)] text-[#403770] font-semibold"
          : "bg-[#F7F5FA] border-[#D4CFE2] text-[#8A80A8] hover:bg-white",
        dim && "opacity-55"
      )}
      style={{ "--dk-color": meta.color } as React.CSSProperties}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[10px] font-extrabold leading-none",
          active ? "text-white" : "text-[#8A80A8]"
        )}
        style={{ background: active ? meta.color : "#E2DEEC" }}
      >
        {meta.glyph}
      </span>
      {meta.label}
    </button>
  );
}

function MultiSelectMenu({
  label,
  items,
  selected,
  onChange,
  searchable = false,
}: {
  label: string;
  items: { value: string; label: string; dot?: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
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

  const partial = selected.length > 0 && selected.length < items.length;
  const filtered = searchable && query
    ? items.filter((it) => it.label.toLowerCase().includes(query.toLowerCase()))
    : items;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium",
          "rounded-full border transition-colors duration-[120ms]",
          "fm-focus-ring",
          partial
            ? "bg-white border-[#403770] text-[#403770] font-bold"
            : selected.length === 0
              ? "bg-[#F7F5FA] border-dashed border-[#D4CFE2] text-[#544A78] hover:bg-white"
              : "bg-white border-[#D4CFE2] text-[#403770]"
        )}
      >
        {label}
        {selected.length > 0 && (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[9px] font-extrabold text-white bg-[#403770] rounded-full tabular-nums">
            {selected.length}
          </span>
        )}
        <ChevronDown className="w-3 h-3 opacity-70" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 top-full mt-1 z-30 min-w-[220px] max-h-72 bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden"
        >
          {searchable && items.length > 6 && (
            <div className="p-2 border-b border-[#E2DEEC]">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="w-full px-2 py-1 text-xs bg-[#F7F5FA] border border-[#E2DEEC] rounded focus:outline-none focus:border-[#403770] text-[#403770]"
              />
            </div>
          )}
          <div className="overflow-y-auto max-h-64 p-1">
            {filtered.length === 0 ? (
              <div className="px-2 py-1.5 text-xs text-[#A69DC0]">No options</div>
            ) : (
              filtered.map((it) => {
                const active = selected.includes(it.value);
                return (
                  <button
                    key={it.value}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(it.value)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md hover:bg-[#F7F5FA] focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px]"
                  >
                    <span
                      className={cn(
                        "w-3.5 h-3.5 inline-flex items-center justify-center rounded-sm border-[1.5px]",
                        active ? "bg-[#403770] border-[#403770]" : "border-[#C2BBD4]"
                      )}
                    >
                      {active && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                          <path
                            d="M2 5.5 L4 7.5 L8 3"
                            stroke="#fff"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </span>
                    {it.dot && (
                      <span
                        aria-hidden="true"
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: it.dot }}
                      />
                    )}
                    <span className="text-[#403770] flex-1 truncate">{it.label}</span>
                  </button>
                );
              })
            )}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full px-2 py-1.5 text-xs font-medium text-[#F37167] hover:bg-[#FEF2F1] border-t border-[#E2DEEC]"
            >
              Clear {label.toLowerCase()}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
