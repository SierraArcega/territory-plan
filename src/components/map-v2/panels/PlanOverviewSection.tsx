"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { STATE_BBOX } from "@/components/map-v2/MapV2Container";
import {
  useTerritoryPlan,
  useTags,
  useAddDistrictTag,
  useRemoveDistrictTag,
} from "@/lib/api";
import type { TerritoryPlanDistrict } from "@/lib/api";

type SortBy = "alpha" | "enrollment" | "state" | "target" | "tag" | "owner";

const SORT_OPTIONS: Array<{ key: SortBy; label: string }> = [
  { key: "alpha", label: "A-Z" },
  { key: "enrollment", label: "Enrollment" },
  { key: "state", label: "State" },
  { key: "target", label: "Target $" },
  { key: "tag", label: "Tag" },
  { key: "owner", label: "Owner" },
];

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "\u2014";
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export default function PlanOverviewSection() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const openRightPanel = useMapV2Store((s) => s.openRightPanel);
  const setPanelState = useMapV2Store((s) => s.setPanelState);
  const rightPanelContent = useMapV2Store((s) => s.rightPanelContent);
  const focusPlanId = useMapV2Store((s) => s.focusPlanId);
  const focusPlan = useMapV2Store((s) => s.focusPlan);
  const unfocusPlan = useMapV2Store((s) => s.unfocusPlan);
  const activeDistrictId =
    rightPanelContent?.type === "district_card" ? rightPanelContent.id : null;

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const [sortBy, setSortBy] = useState<SortBy>("alpha");

  const totalEnrollment = useMemo(() => {
    if (!plan) return 0;
    return plan.districts.reduce((sum, d) => sum + (d.enrollment || 0), 0);
  }, [plan]);

  const targetTotals = useMemo(() => {
    if (!plan) return null;
    const renewal = plan.districts.reduce(
      (s, d) => s + (d.renewalTarget ?? 0),
      0
    );
    const winback = plan.districts.reduce(
      (s, d) => s + (d.winbackTarget ?? 0),
      0
    );
    const expansion = plan.districts.reduce(
      (s, d) => s + (d.expansionTarget ?? 0),
      0
    );
    const newBiz = plan.districts.reduce(
      (s, d) => s + (d.newBusinessTarget ?? 0),
      0
    );
    const total = renewal + winback + expansion + newBiz;
    return { renewal, winback, expansion, newBiz, total };
  }, [plan]);

  const sortedDistricts = useMemo(() => {
    if (!plan) return [];
    const districts = [...plan.districts];
    const byName = (a: TerritoryPlanDistrict, b: TerritoryPlanDistrict) =>
      a.name.localeCompare(b.name);
    switch (sortBy) {
      case "alpha":
        return districts.sort(byName);
      case "enrollment":
        return districts.sort(
          (a, b) => (b.enrollment || 0) - (a.enrollment || 0)
        );
      case "state":
        return districts.sort((a, b) => {
          const sc = (a.stateAbbrev || "").localeCompare(b.stateAbbrev || "");
          return sc !== 0 ? sc : byName(a, b);
        });
      case "target":
        return districts.sort(
          (a, b) => districtTargetTotal(b) - districtTargetTotal(a)
        );
      case "tag":
        return districts.sort((a, b) => {
          const aTag = a.tags[0]?.name || "";
          const bTag = b.tags[0]?.name || "";
          if (!aTag && bTag) return 1;
          if (aTag && !bTag) return -1;
          const tc = aTag.localeCompare(bTag);
          return tc !== 0 ? tc : byName(a, b);
        });
      case "owner":
        return districts.sort((a, b) => {
          const aOwner = a.owner || "";
          const bOwner = b.owner || "";
          if (!aOwner && bOwner) return 1;
          if (aOwner && !bOwner) return -1;
          const oc = aOwner.localeCompare(bOwner);
          return oc !== 0 ? oc : byName(a, b);
        });
      default:
        return districts;
    }
  }, [plan, sortBy]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!plan) {
    return (
      <div className="p-3 text-center py-8 text-xs text-gray-400">
        Plan not found
      </div>
    );
  }

  // Compute combined bounding box for all states in the plan
  const handleFocusMap = () => {
    if (!plan) return;
    const isFocused = focusPlanId === plan.id;

    if (isFocused) {
      unfocusPlan();
      return;
    }

    // Compute combined bbox from all plan states
    const abbrevs = plan.states.map((s) => s.abbrev);
    let minLng = 180, minLat = 90, maxLng = -180, maxLat = -90;
    for (const abbrev of abbrevs) {
      const bbox = STATE_BBOX[abbrev];
      if (!bbox) continue;
      if (bbox[0][0] < minLng) minLng = bbox[0][0];
      if (bbox[0][1] < minLat) minLat = bbox[0][1];
      if (bbox[1][0] > maxLng) maxLng = bbox[1][0];
      if (bbox[1][1] > maxLat) maxLat = bbox[1][1];
    }

    if (minLng > maxLng) return; // no valid bboxes found
    focusPlan(plan.id, abbrevs, [[minLng, minLat], [maxLng, maxLat]]);
  };

  const isFocused = focusPlanId === plan?.id;

  return (
    <div className="p-3 space-y-3">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            Districts
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {plan.districts.length}
          </div>
        </div>
        <div className="rounded-xl bg-gray-50 p-2.5">
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
            Total Enrollment
          </div>
          <div className="text-sm font-semibold text-gray-700">
            {formatNumber(totalEnrollment)}
          </div>
        </div>
      </div>

      {/* Plan-level target summary */}
      {targetTotals && targetTotals.total > 0 && (
        <TargetSummary totals={targetTotals} />
      )}

      {/* Focus Map toggle */}
      {plan.districts.length > 0 && (
        <button
          onClick={handleFocusMap}
          className={`
            w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium rounded-xl transition-all
            ${isFocused
              ? "bg-plum text-white hover:bg-plum/90"
              : "bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-plum"
            }
          `}
        >
          {/* Crosshairs icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 1V4M8 12V15M1 8H4M12 8H15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {isFocused ? "Exit Focus" : "Focus Map"}
        </button>
      )}

      {/* Sort + Add row */}
      <div className="flex items-center gap-1.5">
        <SortDropdown value={sortBy} onChange={setSortBy} />
        <div className="flex-1" />
        <button
          onClick={() => setPanelState("PLAN_ADD")}
          className="px-2.5 py-1 text-xs font-medium text-plum bg-plum/10 rounded-lg hover:bg-plum/15 transition-colors"
        >
          + Add
        </button>
      </div>

      {/* District list */}
      {sortedDistricts.length > 0 ? (
        <div className="space-y-0.5">
          {sortedDistricts.map((d) => (
            <DistrictRow
              key={d.leaid}
              district={d}
              planColor={plan.color}
              isActive={activeDistrictId === d.leaid}
              onClick={() =>
                openRightPanel({ type: "district_card", id: d.leaid })
              }
            />
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setPanelState("PLAN_ADD")} />
      )}
    </div>
  );
}

/* ── Plan-level target summary ─────────────────────────────────────────────── */

const SUMMARY_FIELDS: Array<{
  key: "renewal" | "winback" | "expansion" | "newBiz";
  label: string;
  color: string;
}> = [
  { key: "renewal", label: "Renewal", color: "#403770" },
  { key: "winback", label: "Winback", color: "#F37167" },
  { key: "expansion", label: "Expansion", color: "#6EA3BE" },
  { key: "newBiz", label: "New Biz", color: "#48bb78" },
];

function TargetSummary({
  totals,
}: {
  totals: {
    renewal: number;
    winback: number;
    expansion: number;
    newBiz: number;
    total: number;
  };
}) {
  return (
    <div className="rounded-xl border border-gray-100 p-2.5 space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">
          Target Pipeline
        </span>
        <span className="text-sm font-semibold text-gray-700">
          {formatCurrency(totals.total)}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {SUMMARY_FIELDS.map(({ key, label, color }) => {
          const value = totals[key];
          if (value === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-[10px] text-gray-400 truncate">
                {label}
              </span>
              <span className="text-[10px] font-medium text-gray-600 ml-auto">
                {formatCurrency(value)}
              </span>
            </div>
          );
        })}
      </div>

      <TargetBar totals={totals} />
    </div>
  );
}

function TargetBar({
  totals,
}: {
  totals: {
    renewal: number;
    winback: number;
    expansion: number;
    newBiz: number;
    total: number;
  };
}) {
  if (totals.total === 0) return null;
  const segments = SUMMARY_FIELDS.map(({ key, color }) => ({
    key,
    color,
    pct: Math.round((totals[key] / totals.total) * 100),
  })).filter((s) => s.pct > 0);

  return (
    <div className="flex h-1 rounded-full overflow-hidden gap-px">
      {segments.map((s) => (
        <div
          key={s.key}
          style={{ width: `${s.pct}%`, backgroundColor: s.color }}
        />
      ))}
    </div>
  );
}

/* ── District row ──────────────────────────────────────────────────────────── */

const ROW_TARGET_FIELDS: Array<{
  key: keyof Pick<
    TerritoryPlanDistrict,
    | "renewalTarget"
    | "winbackTarget"
    | "expansionTarget"
    | "newBusinessTarget"
  >;
  label: string;
  color: string;
}> = [
  { key: "renewalTarget", label: "Renewal", color: "#403770" },
  { key: "winbackTarget", label: "Winback", color: "#F37167" },
  { key: "expansionTarget", label: "Expansion", color: "#6EA3BE" },
  { key: "newBusinessTarget", label: "New Biz", color: "#48bb78" },
];

function districtTargetTotal(district: TerritoryPlanDistrict) {
  return ROW_TARGET_FIELDS.reduce(
    (sum, f) => sum + (district[f.key] ?? 0),
    0
  );
}

function DistrictRow({
  district,
  planColor,
  isActive,
  onClick,
}: {
  district: TerritoryPlanDistrict;
  planColor: string;
  isActive: boolean;
  onClick: () => void;
}) {
  const total = districtTargetTotal(district);
  const hasTargets = total > 0;

  return (
    <div
      className={`rounded-xl transition-colors ${
        !isActive ? "hover:bg-gray-50" : ""
      }`}
      style={
        isActive
          ? {
              backgroundColor: `${planColor}14`,
              boxShadow: `inset 0 0 0 1px ${planColor}35`,
            }
          : undefined
      }
    >
      {/* Main clickable row */}
      <button
        onClick={onClick}
        className="w-full flex items-center gap-2 px-3 py-2 text-left group"
      >
        <div
          className="w-2.5 h-2.5 rounded-md shrink-0"
          style={{ backgroundColor: planColor || "#403770" }}
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm text-gray-700 truncate">{district.name}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1.5">
            <span>{district.stateAbbrev}</span>
            {district.enrollment != null && (
              <>
                <span>&middot;</span>
                <span>{district.enrollment.toLocaleString()}</span>
              </>
            )}
            {district.owner && (
              <>
                <span>&middot;</span>
                <span className="truncate max-w-[80px]">{district.owner}</span>
              </>
            )}
          </div>
        </div>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className="text-gray-300 group-hover:text-gray-400 shrink-0"
        >
          <path
            d="M4.5 3L7.5 6L4.5 9"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Target bar + tags */}
      <div className="px-3 pb-2 space-y-1.5">
        {hasTargets && <DistrictTargetBar district={district} total={total} />}

        <div className="flex flex-wrap items-center gap-1 ml-[18px]">
          {district.tags.map((tag) => (
            <RemovableTagPill
              key={tag.id}
              tag={tag}
              leaid={district.leaid}
            />
          ))}
          <InlineTagPicker
            leaid={district.leaid}
            currentTags={district.tags}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Per-district target bar ───────────────────────────────────────────────── */

function DistrictTargetBar({
  district,
  total,
}: {
  district: TerritoryPlanDistrict;
  total: number;
}) {
  const segments = ROW_TARGET_FIELDS.map(({ key, color }) => ({
    key,
    color,
    value: district[key] ?? 0,
  })).filter((s) => s.value > 0);

  return (
    <div className="ml-[18px] flex items-center gap-2">
      <div className="flex-1 flex h-1.5 rounded-full overflow-hidden gap-px">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{
              width: `${Math.round((s.value / total) * 100)}%`,
              backgroundColor: s.color,
            }}
          />
        ))}
      </div>
      <span className="text-[10px] font-medium text-gray-500 shrink-0">
        {formatCurrency(total)}
      </span>
    </div>
  );
}

/* ── Removable tag pill ────────────────────────────────────────────────────── */

function RemovableTagPill({
  tag,
  leaid,
}: {
  tag: { id: number; name: string; color: string };
  leaid: string;
}) {
  const removeTagMutation = useRemoveDistrictTag();

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
      style={{ backgroundColor: tag.color }}
    >
      {tag.name}
      <button
        onClick={() => removeTagMutation.mutate({ leaid, tagId: tag.id })}
        disabled={removeTagMutation.isPending}
        className="hover:bg-white/25 rounded-full p-px transition-colors disabled:opacity-50"
        aria-label={`Remove ${tag.name}`}
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path
            d="M2 2L6 6M6 2L2 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}

/* ── Inline tag picker ─────────────────────────────────────────────────────── */

function InlineTagPicker({
  leaid,
  currentTags,
}: {
  leaid: string;
  currentTags: Array<{ id: number; name: string; color: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: allTags } = useTags();
  const addTagMutation = useAddDistrictTag();

  const availableTags = useMemo(() => {
    const current = new Set(currentTags.map((t) => t.id));
    const pool = (allTags || []).filter((t) => !current.has(t.id));
    if (!search.trim()) return pool;
    return pool.filter((t) =>
      t.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [allTags, currentTags, search]);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleAdd = (tagId: number) => {
    addTagMutation.mutate({ leaid, tagId });
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-gray-400 hover:text-plum hover:bg-plum/8 border border-dashed border-gray-200 hover:border-plum/30 transition-colors"
        aria-label="Add tag"
      >
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
          <path
            d="M4 1v6M1 4h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        tag
      </button>

      {open && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-44 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <div className="px-2 pt-2 pb-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tags..."
              autoFocus
              className="w-full px-2 py-1 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/30 focus:border-plum/40"
            />
          </div>

          <div className="max-h-40 overflow-y-auto py-1">
            {availableTags.length === 0 ? (
              <div className="px-3 py-2 text-[10px] text-gray-400 italic">
                {search.trim()
                  ? `No tags matching \u201c${search}\u201d`
                  : "No more tags to add"}
              </div>
            ) : (
              availableTags.map((tag) => (
                <button
                  key={tag.id}
                  onClick={() => handleAdd(tag.id)}
                  disabled={addTagMutation.isPending}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-1.5 border-t border-gray-100 text-[9px] text-gray-300">
            Create tags in the district card
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sort dropdown ──────────────────────────────────────────────────────────── */

function SortDropdown({
  value,
  onChange,
}: {
  value: SortBy;
  onChange: (v: SortBy) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeLabel = SORT_OPTIONS.find((o) => o.key === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-150 transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="shrink-0">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sort: {activeLabel}
      </button>

      {open && (
        <div className="absolute z-20 top-full mt-1 left-0 w-36 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden py-1">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                onChange(opt.key);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                value === opt.key
                  ? "text-plum font-medium bg-plum/5"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-xs text-gray-400 mb-3">
        No districts in this plan yet
      </div>
      <button
        onClick={onAdd}
        className="px-4 py-2 bg-plum/10 text-plum text-xs font-medium rounded-xl hover:bg-plum/15 transition-all"
      >
        Add Districts
      </button>
    </div>
  );
}

/* ── Loading skeleton ──────────────────────────────────────────────────────── */

function LoadingSkeleton() {
  return (
    <div className="p-3 space-y-3">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-2.5 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
      {/* Sort bar skeleton */}
      <div className="flex items-center gap-1.5">
        <div className="h-7 bg-gray-100 rounded-lg w-36 animate-pulse" />
        <div className="flex-1" />
        <div className="h-7 bg-plum/10 rounded-lg w-14 animate-pulse" />
      </div>
      {/* District list skeleton */}
      <div className="space-y-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-2 animate-pulse"
          >
            <div className="w-2.5 h-2.5 rounded-md bg-gray-200 shrink-0" />
            <div className="flex-1 min-w-0 space-y-1">
              <div className="h-3.5 bg-gray-200 rounded w-3/4" />
              <div className="h-2.5 bg-gray-100 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
