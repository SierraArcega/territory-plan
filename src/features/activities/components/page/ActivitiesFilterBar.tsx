"use client";

import { useMemo } from "react";
import { RotateCcw, Search } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  CATEGORY_LABELS,
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityCategory,
} from "@/features/activities/types";
import { useUsers, useProfile } from "@/features/shared/lib/queries";
import {
  useActivitiesChrome,
  EMPTY_FILTERS,
  type DealKind,
} from "@/features/activities/lib/filters-store";
import { cn } from "@/features/shared/lib/cn";

const CATEGORY_DOTS: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

const DEAL_KINDS: { id: DealKind; label: string; color: string; glyph: string }[] = [
  { id: "won", label: "Won", color: "#69B34A", glyph: "↗" },
  { id: "lost", label: "Lost", color: "#F37167", glyph: "↘" },
  { id: "created", label: "New", color: "#6EA3BE", glyph: "+" },
  { id: "progressed", label: "Progressed", color: "#403770", glyph: "→" },
];

interface ActivitiesFilterBarProps {
  /** Opens the ⌘K CommandBar overlay. */
  onOpenCommandBar?: () => void;
}

/**
 * Segmented chip filter bar (variant 2). Groups labeled Activities · Deals ·
 * Status · Owners with partial-count badges and inline chips. State /
 * Territory / Tags filters are reachable through the ⌘K command bar in this
 * variant — the bar prioritizes the always-on dimensions.
 *
 * Reference: design_handoff_activities_calendar/reference/components/CalendarChrome.jsx:370-505
 */
export default function ActivitiesFilterBar({ onOpenCommandBar }: ActivitiesFilterBarProps) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const resetFilters = useActivitiesChrome((s) => s.resetFilters);
  const { data: users } = useUsers();
  const { data: profile } = useProfile();

  const categories = useMemo(
    () => Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[],
    []
  );

  // Owners chip list, deduped + "Me" floated to the front when present.
  const ownerOptions = useMemo(() => {
    if (!users) return [];
    return [...users].sort((a, b) => {
      if (profile?.id === a.id) return -1;
      if (profile?.id === b.id) return 1;
      return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
    });
  }, [users, profile?.id]);

  function toggle<T extends string>(key: keyof typeof filters, value: T) {
    const current = (filters[key] as unknown as T[]) || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchFilters({ [key]: next } as Partial<typeof filters>);
  }

  const showOwners = filters.owners.length === 0 || filters.owners.length > 1;

  const anyPartial =
    filters.categories.length > 0 ||
    filters.dealKinds.length > 0 ||
    filters.statuses.length > 0 ||
    (filters.owners.length > 0 && filters.owners.length < ownerOptions.length) ||
    filters.types.length > 0 ||
    filters.states.length > 0 ||
    filters.territories.length > 0 ||
    filters.tags.length > 0 ||
    filters.text.trim().length > 0;

  return (
    <div className="flex items-center gap-2 px-6 py-2.5 bg-white border-b border-[#E2DEEC] flex-wrap">
      <button
        type="button"
        onClick={onOpenCommandBar}
        className="inline-flex items-center gap-2 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2"
      >
        <Search className="w-3.5 h-3.5 text-[#8A80A8]" />
        <span className="text-[#8A80A8]">Search or filter…</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#544A78] bg-[#EFEDF5] border border-[#E2DEEC] rounded">
          ⌘K
        </kbd>
      </button>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      <FilterGroup label="Activities" count={filters.categories.length} total={categories.length}>
        {categories.map((cat) => {
          const active = filters.categories.includes(cat);
          return (
            <BarChip
              key={cat}
              active={active}
              color={CATEGORY_DOTS[cat]}
              onClick={() => toggle("categories", cat)}
              accent="dot"
            >
              {CATEGORY_LABELS[cat]}
            </BarChip>
          );
        })}
      </FilterGroup>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      <FilterGroup label="Deals" count={filters.dealKinds.length} total={DEAL_KINDS.length}>
        {DEAL_KINDS.map((d) => {
          const active = filters.dealKinds.includes(d.id);
          return (
            <BarChip
              key={d.id}
              active={active}
              color={d.color}
              onClick={() => toggle<DealKind>("dealKinds", d.id)}
              accent="glyph"
              glyph={d.glyph}
            >
              {d.label}
            </BarChip>
          );
        })}
      </FilterGroup>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      <FilterGroup label="Status" count={filters.statuses.length} total={VALID_ACTIVITY_STATUSES.length}>
        {VALID_ACTIVITY_STATUSES.map((s) => {
          const cfg = ACTIVITY_STATUS_CONFIG[s];
          const active = filters.statuses.includes(s);
          return (
            <BarChip
              key={s}
              active={active}
              color={cfg.color}
              onClick={() => toggle("statuses", s)}
              accent="bar"
            >
              {cfg.label}
            </BarChip>
          );
        })}
      </FilterGroup>

      {showOwners && ownerOptions.length > 0 && (
        <>
          <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />
          <FilterGroup label="Owners" count={filters.owners.length} total={ownerOptions.length}>
            {ownerOptions.slice(0, 8).map((u) => {
              const active = filters.owners.includes(u.id);
              const isMe = profile?.id === u.id;
              const initials = (u.fullName ?? u.email)
                .split(/\s+/)
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              return (
                <button
                  key={u.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle("owners", u.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 pl-1 pr-2.5 py-0.5 text-xs font-medium",
                    "rounded-full border transition-colors duration-[120ms]",
                    "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2",
                    active
                      ? "bg-white border-[#403770] text-[#403770] font-semibold"
                      : "bg-[#F7F5FA] border-[#D4CFE2] text-[#8A80A8] hover:bg-white opacity-65"
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[9px] font-bold text-white"
                    style={{
                      background: stableColor(u.id),
                      filter: active ? "none" : "saturate(0.4)",
                    }}
                  >
                    {initials}
                  </span>
                  {isMe ? "Me" : u.fullName ?? u.email}
                </button>
              );
            })}
          </FilterGroup>
        </>
      )}

      <div className="ml-auto">
        {anyPartial && (
          <button
            type="button"
            onClick={() => {
              resetFilters();
              if (profile?.id) {
                patchFilters({ ...EMPTY_FILTERS, owners: [profile.id] });
              }
            }}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2"
          >
            <RotateCcw className="w-3 h-3" />
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  count,
  total,
  children,
}: {
  label: string;
  count: number;
  total: number;
  children: React.ReactNode;
}) {
  const partial = count > 0 && count < total;
  return (
    <div className="inline-flex items-center gap-2 flex-wrap">
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
      <div className="inline-flex items-center gap-1 flex-wrap">{children}</div>
    </div>
  );
}

function BarChip({
  active,
  color,
  onClick,
  children,
  accent,
  glyph,
}: {
  active: boolean;
  color: string;
  onClick: () => void;
  children: React.ReactNode;
  accent: "dot" | "glyph" | "bar";
  glyph?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium",
        "rounded-full border transition-colors duration-[120ms] ease-out",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2",
        active
          ? "bg-white border-[var(--bc)] text-[#403770] font-semibold"
          : "bg-[#F7F5FA] border-[#D4CFE2] text-[#8A80A8] hover:bg-white opacity-72"
      )}
      style={{ "--bc": color } as React.CSSProperties}
    >
      {accent === "dot" && (
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-sm"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.6 }}
        />
      )}
      {accent === "glyph" && (
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 rounded text-[10px] font-extrabold leading-none",
            active ? "text-white" : "text-[#8A80A8]"
          )}
          style={{ background: active ? color : "#E2DEEC" }}
        >
          {glyph}
        </span>
      )}
      {accent === "bar" && (
        <span
          aria-hidden="true"
          className="w-[3px] h-2.5 rounded-sm"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.55 }}
        />
      )}
      {children}
    </button>
  );
}

// Cheap deterministic avatar background — same user always gets the same hue.
function stableColor(seed: string): string {
  const palette = ["#403770", "#6EA3BE", "#F37167", "#FFCF70", "#8AA891", "#A78BCA"];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}
