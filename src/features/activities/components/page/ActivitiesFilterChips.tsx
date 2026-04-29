"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, Plus, RotateCcw, Search, Square, SquareCheck, X } from "lucide-react";
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
import { useDistricts } from "@/features/districts/lib/queries";
import {
  useActivitiesChrome,
  EMPTY_FILTERS,
  type ActivitiesFilters,
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

type SectionId = "type" | "status" | "inPerson" | "creators" | "attendees" | "districts";

interface GroupChipSpec {
  id: SectionId;
  label: string;
  items: string[];
  extraCount: number;
  isAll: boolean;
  onClear: () => void;
}

interface ActivitiesFilterChipsProps {
  /** Opens the ⌘K CommandBar overlay. */
  onOpenCommandBar?: () => void;
}

/**
 * Renders the active filters as one summary chip per filter section. Clicking
 * the chip body opens the add-filter popover with that section pre-expanded;
 * clicking × clears every value in the section. The popover's open + expanded
 * state is lifted here so chip clicks can drive it.
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

  // Pulled districts only when chips include them; otherwise no fetch.
  const { data: districtList } = useDistricts(
    { search: "", limit: 200 },
    { enabled: filters.districts.length > 0 }
  );
  const districtByLeaid = useMemo(() => {
    const m = new Map<string, string>();
    (districtList?.districts ?? []).forEach((d) => m.set(d.leaid, d.name));
    return m;
  }, [districtList]);

  // Lifted from AddFilterPopover so chip clicks can drive popover state.
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<SectionId>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  function expandSection(id: SectionId) {
    setExpanded((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setPopoverOpen(true);
  }

  // Outside-click + Escape are scoped to the entire chip-bar wrapper so
  // clicking chips, the search button, or reset doesn't dismiss the popover —
  // only clicks on page content beyond the bar do.
  useEffect(() => {
    if (!popoverOpen) return;
    function onDoc(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setPopoverOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPopoverOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [popoverOpen]);

  // One summary chip per active section, ordered to match the popover layout
  // so visual scanning matches popover scanning. Type merges categories[] +
  // types[] into a single chip group.
  const groupChips: GroupChipSpec[] = useMemo(() => {
    const chips: GroupChipSpec[] = [];

    const categoryKeys = Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[];
    const selectedCategories = categoryKeys.filter((c) => filters.categories.includes(c));
    const orderedTypes: ActivityType[] = [];
    categoryKeys.forEach((c) => {
      const childTypes = ACTIVITY_CATEGORIES[c] as readonly ActivityType[];
      childTypes.forEach((t) => {
        if (filters.types.includes(t)) orderedTypes.push(t);
      });
    });
    if (selectedCategories.length > 0 || orderedTypes.length > 0) {
      const itemLabels = [
        ...selectedCategories.map((c) => CATEGORY_LABELS[c]),
        ...orderedTypes.map((t) => ACTIVITY_TYPE_LABELS[t]),
      ];
      chips.push(
        buildGroupChip({
          id: "type",
          label: "Type",
          itemLabels,
          // "All" detection uses categories only — picking all 6 categories
          // already covers every type, so types[] is irrelevant for All-ness.
          isAll: selectedCategories.length === categoryKeys.length,
          onClear: () => patchFilters({ categories: [], types: [] }),
        })
      );
    }

    if (filters.statuses.length > 0) {
      const orderedStatuses = VALID_ACTIVITY_STATUSES.filter((s) =>
        filters.statuses.includes(s)
      );
      const itemLabels = orderedStatuses.map(
        (s) => ACTIVITY_STATUS_CONFIG[s as keyof typeof ACTIVITY_STATUS_CONFIG]?.label ?? s
      );
      chips.push(
        buildGroupChip({
          id: "status",
          label: "Status",
          itemLabels,
          isAll: filters.statuses.length === VALID_ACTIVITY_STATUSES.length,
          onClear: () => patchFilters({ statuses: [] }),
        })
      );
    }

    if (filters.inPerson.length > 0) {
      const itemLabels = filters.inPerson.map((v) => (v === "yes" ? "In person" : "Virtual"));
      chips.push(
        buildGroupChip({
          id: "inPerson",
          label: "In person?",
          itemLabels,
          isAll: filters.inPerson.length === 2,
          onClear: () => patchFilters({ inPerson: [] }),
        })
      );
    }

    if (filters.owners.length > 0) {
      const ordered = sortPeopleSelection(filters.owners, profile?.id);
      const itemLabels = ordered.map((id) =>
        profile?.id === id ? "Me" : userById.get(id) ?? "Unknown"
      );
      chips.push(
        buildGroupChip({
          id: "creators",
          label: "Created by",
          itemLabels,
          isAll: users != null && filters.owners.length === users.length,
          onClear: () => patchFilters({ owners: [] }),
        })
      );
    }

    if (filters.attendeeIds.length > 0) {
      const ordered = sortPeopleSelection(filters.attendeeIds, profile?.id);
      const itemLabels = ordered.map((id) =>
        profile?.id === id ? "Me" : userById.get(id) ?? "Unknown"
      );
      chips.push(
        buildGroupChip({
          id: "attendees",
          label: "Attendees",
          itemLabels,
          isAll: users != null && filters.attendeeIds.length === users.length,
          onClear: () => patchFilters({ attendeeIds: [] }),
        })
      );
    }

    if (filters.districts.length > 0) {
      const itemLabels = filters.districts.map((d) => districtByLeaid.get(d) ?? "District");
      chips.push(
        buildGroupChip({
          id: "districts",
          label: "District",
          itemLabels,
          // The district universe is unbounded (13k+ entries, search-paginated)
          // so we can't render "All" — there's no canonical total.
          isAll: false,
          onClear: () => patchFilters({ districts: [] }),
        })
      );
    }

    return chips;
  }, [filters, userById, districtByLeaid, profile?.id, users, patchFilters]);

  // Filter sections that aren't in the popover redesign keep their existing
  // per-value chip rendering — they're rarely populated, so the visual cost is
  // small and we avoid scope creep.
  const fallbackChips = useMemo(() => {
    const chips: { key: string; label: string; color?: string; onRemove: () => void }[] = [];
    filters.dealKinds.forEach((d) =>
      chips.push({
        key: `dealKinds:${d}`,
        label: `Deal: ${DEAL_KIND_LABELS[d]}`,
        onRemove: () =>
          patchFilters({ dealKinds: filters.dealKinds.filter((v) => v !== d) }),
      })
    );
    filters.states.forEach((s) =>
      chips.push({
        key: `states:${s}`,
        label: stateByCode.get(s) ?? s,
        onRemove: () => patchFilters({ states: filters.states.filter((v) => v !== s) }),
      })
    );
    filters.territories.forEach((t) =>
      chips.push({
        key: `territories:${t}`,
        label: territoryById.get(t) ?? "Territory",
        onRemove: () =>
          patchFilters({ territories: filters.territories.filter((v) => v !== t) }),
      })
    );
    filters.tags.forEach((t) => {
      const meta = tagById.get(t);
      chips.push({
        key: `tags:${t}`,
        label: meta?.name ?? "Tag",
        color: meta?.color,
        onRemove: () => patchFilters({ tags: filters.tags.filter((v) => v !== t) }),
      });
    });
    return chips;
  }, [filters, stateByCode, territoryById, tagById, patchFilters]);

  const hasAnyChip = groupChips.length > 0 || fallbackChips.length > 0;

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 px-6 py-2.5 bg-white border-b border-[#E2DEEC] flex-wrap"
    >
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

      {!hasAnyChip ? (
        <span className="text-xs text-[#A69DC0] italic">
          No filters active — viewing everything in this range
        </span>
      ) : (
        <>
          {groupChips.map((chip) => (
            <GroupChip
              key={chip.id}
              chip={chip}
              onOpenSection={() => expandSection(chip.id)}
            />
          ))}
          {fallbackChips.map((chip) => (
            <FallbackChip
              key={chip.key}
              label={chip.label}
              color={chip.color}
              onRemove={chip.onRemove}
            />
          ))}
        </>
      )}

      <AddFilterPopover
        open={popoverOpen}
        setOpen={setPopoverOpen}
        expanded={expanded}
        setExpanded={setExpanded}
      />

      <div className="ml-auto">
        {hasAnyChip && (
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

function buildGroupChip({
  id,
  label,
  itemLabels,
  isAll,
  onClear,
}: {
  id: SectionId;
  label: string;
  itemLabels: string[];
  isAll: boolean;
  onClear: () => void;
}): GroupChipSpec {
  if (isAll) {
    return { id, label, items: [], extraCount: 0, isAll: true, onClear };
  }
  if (itemLabels.length <= 2) {
    return { id, label, items: itemLabels, extraCount: 0, isAll: false, onClear };
  }
  return {
    id,
    label,
    items: itemLabels.slice(0, 2),
    extraCount: itemLabels.length - 2,
    isAll: false,
    onClear,
  };
}

// Float "Me" to the front of a people-section selection; remaining order
// matches the input array so the chip is stable across re-renders.
function sortPeopleSelection(ids: string[], meId: string | undefined): string[] {
  if (!meId || !ids.includes(meId)) return ids;
  return [meId, ...ids.filter((id) => id !== meId)];
}

function GroupChip({
  chip,
  onOpenSection,
}: {
  chip: GroupChipSpec;
  onOpenSection: () => void;
}) {
  const summary = chip.isAll
    ? "All"
    : chip.extraCount > 0
      ? `${chip.items.join(", ")} +${chip.extraCount}`
      : chip.items.join(", ");

  return (
    <span
      className={cn(
        "inline-flex items-stretch h-7 text-xs font-semibold rounded-full overflow-hidden",
        "bg-white border border-[#D4CFE2] text-[#403770]"
      )}
    >
      <button
        type="button"
        onClick={onOpenSection}
        aria-label={`Edit ${chip.label} filter`}
        className={cn(
          "inline-flex items-center gap-1.5 pl-2.5 pr-2",
          "hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors fm-focus-ring"
        )}
      >
        <span className="text-[10px] font-extrabold uppercase tracking-[0.06em] text-[#8A80A8]">
          {chip.label}
        </span>
        <span aria-hidden className="text-[#D4CFE2]">·</span>
        <span className="text-[#403770]">{summary}</span>
      </button>
      <button
        type="button"
        aria-label={`Clear ${chip.label} filter`}
        onClick={chip.onClear}
        className={cn(
          "inline-flex items-center justify-center w-6 border-l border-[#EFEDF5]",
          "text-[#8A80A8] hover:text-[#F37167] hover:bg-[#FEF2F1]",
          "[transition-duration:120ms] transition-colors fm-focus-ring"
        )}
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

function FallbackChip({
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

function AddFilterPopover({
  open,
  setOpen,
  expanded,
  setExpanded,
}: {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  expanded: Set<SectionId>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<SectionId>>>;
}) {
  const [districtQuery, setDistrictQuery] = useState("");
  const [debouncedDistrictQuery, setDebouncedDistrictQuery] = useState("");
  const filters = useActivitiesChrome((s) => s.filters);
  const patchFilters = useActivitiesChrome((s) => s.patchFilters);
  const { data: profile } = useProfile();
  const { data: users } = useUsers();

  const sectionCounts = useMemo<Record<SectionId, number>>(
    () => ({
      type: filters.categories.length + filters.types.length,
      status: filters.statuses.length,
      inPerson: filters.inPerson.length,
      creators: filters.owners.length,
      attendees: filters.attendeeIds.length,
      districts: filters.districts.length,
    }),
    [filters]
  );

  // Each time the popover opens, auto-expand any section that has active
  // filters so the rep can see what's checked without hunting for it. Once
  // open the user controls expansion freely.
  useEffect(() => {
    if (!open) return;
    setExpanded((prev) => {
      const next = new Set(prev);
      (Object.keys(sectionCounts) as SectionId[]).forEach((id) => {
        if (sectionCounts[id] > 0) next.add(id);
      });
      return next;
    });
    // Intentionally only run when `open` flips true — re-running on every
    // sectionCounts change would force a section back open after the user
    // collapsed it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedDistrictQuery(districtQuery.trim()), 250);
    return () => clearTimeout(t);
  }, [districtQuery]);

  // Only fetch districts when the District section is expanded. Searches run
  // against the full district set so any district can be filtered on, not
  // just ones touched by activities in the current range.
  const { data: districtSearch, isLoading: districtsLoading } = useDistricts(
    { search: debouncedDistrictQuery, limit: 50 },
    { enabled: open && expanded.has("districts") }
  );
  const districtResults = districtSearch?.districts ?? [];

  function toggle<T extends string>(key: keyof ActivitiesFilters, value: T) {
    const current = (filters[key] as unknown as T[]) || [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    patchFilters({ [key]: next } as Partial<ActivitiesFilters>);
  }

  function toggleSection(id: SectionId) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Sort users so "Me" floats to the top of the people lists.
  const sortedUsers = useMemo(() => {
    const list = users ?? [];
    return [...list].sort((a, b) => {
      if (profile?.id === a.id) return -1;
      if (profile?.id === b.id) return 1;
      return (a.fullName ?? a.email).localeCompare(b.fullName ?? b.email);
    });
  }, [users, profile?.id]);

  return (
    <div className="relative">
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
        <div className="absolute left-0 top-full mt-1 z-30 w-[320px] max-h-[480px] overflow-y-auto bg-white border border-[#D4CFE2] rounded-xl shadow-lg p-1">
          <SectionHeaderButton
            label="Type"
            count={sectionCounts.type}
            expanded={expanded.has("type")}
            onClick={() => toggleSection("type")}
            hint="Pick any combination"
            onSelectAll={() =>
              patchFilters({
                categories: Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[],
                types: [],
              })
            }
            onClear={() => patchFilters({ categories: [], types: [] })}
          />
          {expanded.has("type") &&
            (Object.keys(ACTIVITY_CATEGORIES) as ActivityCategory[]).map((c) => {
              const childTypes = ACTIVITY_CATEGORIES[c] as readonly ActivityType[];
              return (
                <div key={c} className="mb-0.5">
                  <PopoverItem
                    dot={CATEGORY_DOTS[c]}
                    label={CATEGORY_LABELS[c]}
                    emphasized
                    active={filters.categories.includes(c)}
                    onClick={() => toggle("categories", c)}
                  />
                  {childTypes.map((t) => (
                    <PopoverItem
                      key={t}
                      label={ACTIVITY_TYPE_LABELS[t]}
                      indent
                      active={filters.types.includes(t)}
                      onClick={() => toggle("types", t)}
                    />
                  ))}
                </div>
              );
            })}

          <SectionHeaderButton
            label="Status"
            count={sectionCounts.status}
            expanded={expanded.has("status")}
            onClick={() => toggleSection("status")}
            hint="Pick any combination"
            onSelectAll={() => patchFilters({ statuses: [...VALID_ACTIVITY_STATUSES] })}
            onClear={() => patchFilters({ statuses: [] })}
          />
          {expanded.has("status") &&
            VALID_ACTIVITY_STATUSES.map((s) => {
              const cfg = ACTIVITY_STATUS_CONFIG[s];
              return (
                <PopoverItem
                  key={s}
                  dot={cfg.color}
                  label={cfg.label}
                  active={filters.statuses.includes(s)}
                  onClick={() => toggle("statuses", s)}
                />
              );
            })}

          <SectionHeaderButton
            label="In person?"
            count={sectionCounts.inPerson}
            expanded={expanded.has("inPerson")}
            onClick={() => toggleSection("inPerson")}
            hint="Pick either or both"
            onSelectAll={() => patchFilters({ inPerson: ["yes", "no"] })}
            onClear={() => patchFilters({ inPerson: [] })}
          />
          {expanded.has("inPerson") && (
            <>
              <PopoverItem
                label="In person"
                active={filters.inPerson.includes("yes")}
                onClick={() => toggle("inPerson", "yes")}
              />
              <PopoverItem
                label="Virtual"
                active={filters.inPerson.includes("no")}
                onClick={() => toggle("inPerson", "no")}
              />
            </>
          )}

          <SectionHeaderButton
            label="Created by"
            count={sectionCounts.creators}
            expanded={expanded.has("creators")}
            onClick={() => toggleSection("creators")}
            hint="Pick any combination"
            onSelectAll={() =>
              patchFilters({ owners: sortedUsers.map((u) => u.id) })
            }
            onClear={() => patchFilters({ owners: [] })}
          />
          {expanded.has("creators") &&
            sortedUsers.map((u) => (
              <PopoverItem
                key={`creator-${u.id}`}
                avatar={initials(u.fullName ?? u.email)}
                label={profile?.id === u.id ? "Me" : u.fullName ?? u.email}
                active={filters.owners.includes(u.id)}
                onClick={() => toggle("owners", u.id)}
              />
            ))}

          <SectionHeaderButton
            label="Attendees"
            count={sectionCounts.attendees}
            expanded={expanded.has("attendees")}
            onClick={() => toggleSection("attendees")}
            hint="Pick any combination"
            onSelectAll={() =>
              patchFilters({ attendeeIds: sortedUsers.map((u) => u.id) })
            }
            onClear={() => patchFilters({ attendeeIds: [] })}
          />
          {expanded.has("attendees") &&
            sortedUsers.map((u) => (
              <PopoverItem
                key={`attendee-${u.id}`}
                avatar={initials(u.fullName ?? u.email)}
                label={profile?.id === u.id ? "Me" : u.fullName ?? u.email}
                active={filters.attendeeIds.includes(u.id)}
                onClick={() => toggle("attendeeIds", u.id)}
              />
            ))}

          <SectionHeaderButton
            label="District"
            count={sectionCounts.districts}
            expanded={expanded.has("districts")}
            onClick={() => toggleSection("districts")}
            hint="Pick any combination"
            onClear={() => patchFilters({ districts: [] })}
          />
          {expanded.has("districts") && (
            <>
              <div className="px-1.5 pt-1 pb-1.5">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0]" />
                  <input
                    type="text"
                    value={districtQuery}
                    onChange={(e) => setDistrictQuery(e.target.value)}
                    placeholder="Search districts…"
                    className="w-full pl-7 pr-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-md text-[#403770] placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
                  />
                </div>
              </div>
              {districtsLoading ? (
                <div className="px-3 py-2 text-[11px] text-[#A69DC0] italic">Loading…</div>
              ) : districtResults.length === 0 ? (
                <div className="px-3 py-2 text-[11px] text-[#A69DC0] italic">
                  {debouncedDistrictQuery ? "No districts match." : "Type to search…"}
                </div>
              ) : (
                districtResults
                  .slice(0, 25)
                  .map((d) => (
                    <PopoverItem
                      key={d.leaid}
                      label={d.name}
                      sublabel={d.stateAbbrev ?? undefined}
                      active={filters.districts.includes(d.leaid)}
                      onClick={() => toggle("districts", d.leaid)}
                    />
                  ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeaderButton({
  label,
  count,
  expanded,
  onClick,
  hint,
  onSelectAll,
  onClear,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onClick: () => void;
  hint: string;
  onSelectAll?: () => void;
  onClear?: () => void;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div
      className={cn(
        "w-full flex items-center gap-1.5 px-2 py-1.5 mt-0.5 rounded-md [transition-duration:120ms] transition-colors",
        "hover:bg-[#F7F5FA]"
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-expanded={expanded}
        className={cn(
          "flex items-center gap-1.5 flex-1 min-w-0 text-left",
          "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px] rounded-sm"
        )}
      >
        <Chevron className="w-3 h-3 text-[#8A80A8] flex-shrink-0" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#544A78]">
          {label}
        </span>
        {count > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full bg-[#403770] text-white">
            {count}
          </span>
        )}
      </button>
      {expanded ? (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {onSelectAll && (
            <SectionLink onClick={onSelectAll}>All</SectionLink>
          )}
          {onSelectAll && onClear && (
            <span className="text-[10px] text-[#D4CFE2]" aria-hidden>·</span>
          )}
          {onClear && count > 0 && (
            <SectionLink onClick={onClear} variant="muted">Clear</SectionLink>
          )}
        </div>
      ) : (
        <span className="text-[10px] text-[#A69DC0] italic flex-shrink-0">
          {hint}
        </span>
      )}
    </div>
  );
}

function SectionLink({
  children,
  onClick,
  variant = "primary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "muted";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-[10px] font-bold uppercase tracking-[0.06em] [transition-duration:120ms] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-2 rounded-sm",
        variant === "muted"
          ? "text-[#8A80A8] hover:text-[#F37167]"
          : "text-[#544A78] hover:text-[#403770]"
      )}
    >
      {children}
    </button>
  );
}

function PopoverItem({
  dot,
  avatar,
  label,
  sublabel,
  onClick,
  active,
  emphasized,
  indent,
}: {
  dot?: string;
  avatar?: string;
  label: string;
  sublabel?: string;
  onClick: () => void;
  active?: boolean;
  emphasized?: boolean;
  indent?: boolean;
}) {
  const Checkbox = active ? SquareCheck : Square;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left rounded-md [transition-duration:120ms] transition-colors",
        "focus-visible:outline-2 focus-visible:outline-[#F37167] focus-visible:outline-offset-[-2px]",
        indent && "pl-7",
        active
          ? "bg-[#F7F5FA] text-[#403770]"
          : "text-[#403770] hover:bg-[#F7F5FA]",
        emphasized && "font-semibold"
      )}
    >
      <Checkbox
        className={cn(
          "w-3.5 h-3.5 flex-shrink-0",
          active ? "text-[#403770]" : "text-[#A69DC0]"
        )}
        aria-hidden
      />
      {dot && (
        <span
          aria-hidden="true"
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      {avatar && (
        <span
          aria-hidden="true"
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 bg-[#EFEDF5] text-[#544A78]"
        >
          {avatar}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {sublabel && (
        <span className="text-[10px] flex-shrink-0 text-[#A69DC0]">
          {sublabel}
        </span>
      )}
    </button>
  );
}

function initials(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}
