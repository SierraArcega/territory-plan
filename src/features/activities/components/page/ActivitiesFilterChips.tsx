"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, RotateCcw, Search, X } from "lucide-react";
import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_TYPE_LABELS,
  CATEGORY_LABELS,
  ACTIVITY_STATUS_CONFIG,
  VALID_ACTIVITY_STATUSES,
  type ActivityCategory,
  type ActivityType,
} from "@/features/activities/types";
import { useUsers, useProfile, useTags } from "@/features/shared/lib/queries";
import { useStates } from "@/features/map/lib/queries";
import { useTerritoryPlans } from "@/features/plans/lib/queries";
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

const DEAL_KIND_LABELS: Record<DealKind, string> = {
  won: "Won",
  lost: "Lost",
  created: "New",
  progressed: "Progressed",
  closing: "Closing",
};

interface ActivitiesFilterChipsProps {
  /** Opens the ⌘K CommandBar overlay. */
  onOpenCommandBar?: () => void;
}

type ChipSpec = {
  groupKey: keyof ReturnType<typeof useActivitiesChrome.getState>["filters"];
  value: string;
  label: string;
  color?: string;
};

/**
 * Chips variant (3): renders only the active filters as removable pills with
 * a "+ Filter" button that opens an add-filter popover. Designed to be the
 * lowest-chrome variant — quiet by default, visible only when filters are on.
 */
export default function ActivitiesFilterChips({ onOpenCommandBar }: ActivitiesFilterChipsProps) {
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const resetFilters = useActivitiesChrome((s) => s.resetFilters);

  const { data: profile } = useProfile();
  const { data: users } = useUsers();
  const { data: states } = useStates({ enabled: true });
  const { data: territories } = useTerritoryPlans({ enabled: true });
  const { data: tags } = useTags();

  const userById = useMemo(() => {
    const m = new Map<string, string>();
    (users ?? []).forEach((u) => m.set(u.id, u.fullName ?? u.email));
    return m;
  }, [users]);
  const stateByCode = useMemo(() => {
    const m = new Map<string, string>();
    (states ?? []).forEach((s) => m.set(s.abbrev, s.name));
    return m;
  }, [states]);
  const territoryById = useMemo(() => {
    const m = new Map<string, string>();
    (territories ?? []).forEach((t) => m.set(t.id, t.name));
    return m;
  }, [territories]);
  const tagById = useMemo(() => {
    const m = new Map<string, { name: string; color: string }>();
    (tags ?? []).forEach((t) => m.set(String(t.id), { name: t.name, color: t.color }));
    return m;
  }, [tags]);

  const activeChips: ChipSpec[] = useMemo(() => {
    const chips: ChipSpec[] = [];
    filters.categories.forEach((c) =>
      chips.push({
        groupKey: "categories",
        value: c,
        label: CATEGORY_LABELS[c],
        color: CATEGORY_DOTS[c],
      })
    );
    filters.types.forEach((t) =>
      chips.push({
        groupKey: "types",
        value: t,
        label: ACTIVITY_TYPE_LABELS[t],
      })
    );
    filters.dealKinds.forEach((d) =>
      chips.push({ groupKey: "dealKinds", value: d, label: `Deal: ${DEAL_KIND_LABELS[d]}` })
    );
    filters.statuses.forEach((s) =>
      chips.push({
        groupKey: "statuses",
        value: s,
        label: ACTIVITY_STATUS_CONFIG[s as keyof typeof ACTIVITY_STATUS_CONFIG]?.label ?? s,
        color: ACTIVITY_STATUS_CONFIG[s as keyof typeof ACTIVITY_STATUS_CONFIG]?.color,
      })
    );
    filters.owners.forEach((o) =>
      chips.push({
        groupKey: "owners",
        value: o,
        label: profile?.id === o ? "Me" : userById.get(o) ?? "Owner",
      })
    );
    filters.states.forEach((s) =>
      chips.push({
        groupKey: "states",
        value: s,
        label: stateByCode.get(s) ?? s,
      })
    );
    filters.territories.forEach((t) =>
      chips.push({
        groupKey: "territories",
        value: t,
        label: territoryById.get(t) ?? "Territory",
      })
    );
    filters.tags.forEach((t) => {
      const meta = tagById.get(t);
      chips.push({ groupKey: "tags", value: t, label: meta?.name ?? "Tag", color: meta?.color });
    });
    return chips;
  }, [filters, userById, stateByCode, territoryById, tagById, profile?.id]);

  function removeChip(spec: ChipSpec) {
    const current = filters[spec.groupKey] as unknown as string[] | number[];
    if (!Array.isArray(current)) return;
    const next = (current as string[]).filter((v) => v !== spec.value);
    patchFilters({ [spec.groupKey]: next } as Partial<typeof filters>);
  }

  return (
    <div className="flex items-center gap-1.5 px-6 py-2.5 bg-white border-b border-[#E2DEEC] flex-wrap">
      <button
        type="button"
        onClick={onOpenCommandBar}
        className="inline-flex items-center gap-2 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <Search className="w-3.5 h-3.5 text-[#8A80A8]" />
        <span className="text-[#8A80A8]">Search…</span>
        <kbd className="px-1.5 py-0.5 text-[10px] font-bold text-[#544A78] bg-[#EFEDF5] border border-[#E2DEEC] rounded">
          ⌘K
        </kbd>
      </button>

      <span aria-hidden="true" className="w-px h-5 bg-[#E2DEEC]" />

      {activeChips.length === 0 ? (
        <span className="text-xs text-[#A69DC0] italic">
          No filters active — viewing everything in this range
        </span>
      ) : (
        activeChips.map((chip) => (
          <ActiveChip
            key={`${String(chip.groupKey)}:${chip.value}`}
            label={chip.label}
            color={chip.color}
            onRemove={() => removeChip(chip)}
          />
        ))
      )}

      <AddFilterPopover />

      <div className="ml-auto">
        {activeChips.length > 0 && (
          <button
            type="button"
            onClick={() => {
              resetFilters();
              if (profile?.id) {
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
  );
}

function ActiveChip({
  label,
  color,
  onRemove,
}: {
  label: string;
  color?: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 text-xs font-semibold",
        "rounded-full bg-white border border-[#D4CFE2] text-[#403770]"
      )}
    >
      {color && (
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-sm"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
      <button
        type="button"
        aria-label={`Remove filter: ${label}`}
        onClick={onRemove}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[#8A80A8] hover:text-[#F37167] hover:bg-[#FEF2F1] [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function AddFilterPopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function add<T extends string>(key: keyof typeof filters, value: T) {
    const current = (filters[key] as unknown as T[]) || [];
    if (current.includes(value)) return;
    patchFilters({ [key]: [...current, value] } as Partial<typeof filters>);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-[#544A78] bg-white border border-dashed border-[#D4CFE2] rounded-full hover:bg-[#F7F5FA] hover:border-solid [transition-duration:120ms] transition-colors fm-focus-ring"
      >
        <Plus className="w-3 h-3" />
        Filter
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 min-w-[240px] max-h-80 overflow-y-auto bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1">
          <SectionHeader>Category</SectionHeader>
          {(Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => (
            <PopoverItem
              key={c}
              dot={CATEGORY_DOTS[c]}
              label={CATEGORY_LABELS[c]}
              onClick={() => add("categories", c)}
              disabled={filters.categories.includes(c)}
            />
          ))}
          <SectionHeader>Type</SectionHeader>
          {(Object.keys(ACTIVITY_TYPE_LABELS) as ActivityType[]).map((t) => (
            <PopoverItem
              key={t}
              label={ACTIVITY_TYPE_LABELS[t]}
              onClick={() => add("types", t)}
              disabled={filters.types.includes(t)}
            />
          ))}
          <SectionHeader>Status</SectionHeader>
          {VALID_ACTIVITY_STATUSES.map((s) => {
            const cfg = ACTIVITY_STATUS_CONFIG[s];
            return (
              <PopoverItem
                key={s}
                dot={cfg.color}
                label={cfg.label}
                onClick={() => add("statuses", s)}
                disabled={filters.statuses.includes(s)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-2 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#8A80A8]">
      {children}
    </div>
  );
}

function PopoverItem({
  dot,
  label,
  onClick,
  disabled,
}: {
  dot?: string;
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md transition-colors",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px]",
        disabled
          ? "text-[#A69DC0] cursor-not-allowed"
          : "text-[#403770] hover:bg-[#F7F5FA]"
      )}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: dot, opacity: disabled ? 0.4 : 1 }}
        />
      )}
      <span className="flex-1 truncate">{label}</span>
      {disabled && <span className="text-[10px] text-[#A69DC0]">on</span>}
    </button>
  );
}
