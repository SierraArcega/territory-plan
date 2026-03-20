"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  useUpdateDistrictTargets,
  useRemoveDistrictFromPlan,
  useAddDistrictsToPlan,
} from "@/lib/api";
import { useMapV2Store } from "@/features/map/lib/store";
import type {
  TerritoryPlanDetail,
  TerritoryPlanDistrict,
} from "@/features/shared/types/api-types";

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function parseCurrency(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

type SortColumn = "name" | "state" | "renewal" | "expansion" | "winback" | "newBiz" | "total" | "actual";

interface PlanDistrictsTabProps {
  plan: TerritoryPlanDetail;
  onClose: () => void;
}

export default function PlanDistrictsTab({ plan, onClose }: PlanDistrictsTabProps) {
  const [expandedLeaid, setExpandedLeaid] = useState<string | null>(null);
  const [sortCol, setSortCol] = useState<SortColumn>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showAddDropdown, setShowAddDropdown] = useState(false);

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const sortedDistricts = useMemo(() => {
    const sorted = [...plan.districts];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "name": cmp = (a.name ?? "").localeCompare(b.name ?? ""); break;
        case "state": cmp = (a.stateAbbrev ?? "").localeCompare(b.stateAbbrev ?? ""); break;
        case "renewal": cmp = (a.renewalTarget ?? 0) - (b.renewalTarget ?? 0); break;
        case "expansion": cmp = (a.expansionTarget ?? 0) - (b.expansionTarget ?? 0); break;
        case "winback": cmp = (a.winbackTarget ?? 0) - (b.winbackTarget ?? 0); break;
        case "newBiz": cmp = (a.newBusinessTarget ?? 0) - (b.newBusinessTarget ?? 0); break;
        case "total": {
          const ta = (a.renewalTarget ?? 0) + (a.expansionTarget ?? 0) + (a.winbackTarget ?? 0) + (a.newBusinessTarget ?? 0);
          const tb = (b.renewalTarget ?? 0) + (b.expansionTarget ?? 0) + (b.winbackTarget ?? 0) + (b.newBusinessTarget ?? 0);
          cmp = ta - tb;
          break;
        }
        case "actual": cmp = (a.actuals?.totalRevenue ?? 0) - (b.actuals?.totalRevenue ?? 0); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [plan.districts, sortCol, sortDir]);

  if (plan.districts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <svg className="w-10 h-10 text-[#C2BBD4] mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
        <p className="text-sm font-medium text-[#6E6390]">No districts yet</p>
        <p className="text-xs text-[#A69DC0] mt-1">Add districts to start building your territory plan.</p>
        <div className="mt-4 flex items-center gap-2">
          <AddDistrictButton planId={plan.id} existingLeaids={[]} />
          <BrowseMapButton planId={plan.id} onClose={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="shrink-0 border-b border-[#E2DEEC] bg-[#FAFAFE]">
        <div className="grid grid-cols-[1fr_50px_90px_90px_90px_90px_90px_90px_32px] items-center px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
          <SortHeader label="District" col="name" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <SortHeader label="St" col="state" activeCol={sortCol} dir={sortDir} onSort={handleSort} />
          <SortHeader label="Renewal" col="renewal" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="Expansion" col="expansion" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="Winback" col="winback" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="New Biz" col="newBiz" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="Total" col="total" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <SortHeader label="Actual" col="actual" activeCol={sortCol} dir={sortDir} onSort={handleSort} align="right" />
          <span />
        </div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {sortedDistricts.map((district) => (
          <DistrictRow
            key={district.leaid}
            district={district}
            planId={plan.id}
            isExpanded={expandedLeaid === district.leaid}
            onToggle={() =>
              setExpandedLeaid((prev) =>
                prev === district.leaid ? null : district.leaid
              )
            }
          />
        ))}
      </div>

      {/* Footer: Add district */}
      <div className="shrink-0 border-t border-[#E2DEEC] px-5 py-3 flex items-center justify-between bg-[#FAFAFE]">
        <div className="flex items-center gap-2 relative">
          <AddDistrictButton
            planId={plan.id}
            existingLeaids={plan.districts.map((d) => d.leaid)}
          />
          <BrowseMapButton planId={plan.id} onClose={onClose} />
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

// ─── District Row ───────────────────────────────────────────────────

function DistrictRow({
  district,
  planId,
  isExpanded,
  onToggle,
}: {
  district: TerritoryPlanDistrict;
  planId: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const updateTargets = useUpdateDistrictTargets();
  const removeMutation = useRemoveDistrictFromPlan();
  const [confirmRemove, setConfirmRemove] = useState(false);

  const totalTarget =
    (district.renewalTarget ?? 0) +
    (district.expansionTarget ?? 0) +
    (district.winbackTarget ?? 0) +
    (district.newBusinessTarget ?? 0);

  const handleTargetSave = useCallback(
    (field: string, value: number | null) => {
      updateTargets.mutate({
        planId,
        leaid: district.leaid,
        [field]: value,
      });
    },
    [planId, district.leaid, updateTargets]
  );

  const handleNotesSave = useCallback(
    (notes: string) => {
      updateTargets.mutate({
        planId,
        leaid: district.leaid,
        notes: notes || null,
      });
    },
    [planId, district.leaid, updateTargets]
  );

  const handleRemove = () => {
    removeMutation.mutate({ planId, leaid: district.leaid });
    setConfirmRemove(false);
  };

  return (
    <div className="border-b border-[#f0edf5] last:border-b-0">
      {/* Main row */}
      <div
        className="grid grid-cols-[1fr_50px_90px_90px_90px_90px_90px_90px_32px] items-center px-5 py-2.5 hover:bg-[#FAFAFE] transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            className={`shrink-0 text-[#A69DC0] transition-transform ${isExpanded ? "rotate-90" : ""}`}
          >
            <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <span className="text-xs font-medium text-[#544A78] truncate">{district.name}</span>
        </div>
        <span className="text-[11px] text-[#8A80A8]">{district.stateAbbrev ?? "—"}</span>
        <InlineEditableCell
          value={district.renewalTarget}
          onSave={(v) => handleTargetSave("renewalTarget", v)}
        />
        <InlineEditableCell
          value={district.expansionTarget}
          onSave={(v) => handleTargetSave("expansionTarget", v)}
        />
        <InlineEditableCell
          value={district.winbackTarget}
          onSave={(v) => handleTargetSave("winbackTarget", v)}
        />
        <InlineEditableCell
          value={district.newBusinessTarget}
          onSave={(v) => handleTargetSave("newBusinessTarget", v)}
        />
        <span className="text-xs font-semibold text-[#403770] text-right tabular-nums pr-2">
          {formatCurrency(totalTarget)}
        </span>
        <span className="text-xs text-[#6E6390] text-right tabular-nums pr-2">
          {formatCurrency(district.actuals?.totalRevenue)}
        </span>

        {/* Remove button */}
        <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
          {confirmRemove ? (
            <button
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="text-[9px] font-bold text-[#F37167] hover:text-[#d4534a] transition-colors"
            >
              {removeMutation.isPending ? "..." : "Yes"}
            </button>
          ) : (
            <button
              onClick={() => setConfirmRemove(true)}
              className="w-6 h-6 rounded flex items-center justify-center text-[#C2BBD4] hover:text-[#F37167] hover:bg-[#FEF2F1] transition-colors opacity-0 group-hover:opacity-100"
              style={{ opacity: undefined }}
              onMouseLeave={() => setConfirmRemove(false)}
              aria-label={`Remove ${district.name}`}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                <path d="M2 3H10M4 3V2H8V3M5 5V9M7 5V9M3 3V10.5C3 10.8 3.2 11 3.5 11H8.5C8.8 11 9 10.8 9 10.5V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="px-5 pb-4 pl-10 space-y-3 bg-[#FAFAFE]">
          {/* Pipeline details */}
          {district.actuals && (
            <div className="flex flex-wrap gap-4 text-[11px]">
              <PipelineStat label="Pipeline" value={district.actuals.openPipeline} />
              <PipelineStat label="Revenue" value={district.actuals.totalRevenue} />
              <PipelineStat label="Completed" value={district.actuals.completedRevenue} />
              <PipelineStat label="Scheduled" value={district.actuals.scheduledRevenue} />
              {district.actuals.oppCount > 0 && (
                <span className="text-[#8A80A8]">
                  {district.actuals.oppCount} opp{district.actuals.oppCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Services */}
          <div className="flex flex-wrap gap-4">
            {district.returnServices.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69DC0] block mb-1">Return Services</span>
                <div className="flex flex-wrap gap-1">
                  {district.returnServices.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        backgroundColor: `${s.color}15`,
                        color: s.color,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {district.newServices.length > 0 && (
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69DC0] block mb-1">New Services</span>
                <div className="flex flex-wrap gap-1">
                  {district.newServices.map((s) => (
                    <span
                      key={s.id}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{
                        backgroundColor: `${s.color}15`,
                        color: s.color,
                      }}
                    >
                      {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#A69DC0] block mb-1">Notes</span>
            <AutoSaveTextarea
              initialValue={district.notes ?? ""}
              onSave={handleNotesSave}
              placeholder="Add notes about this district..."
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Inline Editable Cell ─────────────────────────────────────────

function InlineEditableCell({
  value,
  onSave,
}: {
  value: number | null;
  onSave: (value: number | null) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(value != null ? String(value) : "");
    setIsEditing(true);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    const parsed = parseCurrency(editValue);
    if (parsed !== value) {
      onSave(parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur();
    }
    if (e.key === "Escape") {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center justify-end pr-2" onClick={(e) => e.stopPropagation()}>
        <div className="relative w-[72px]">
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#A69DC0]">$</span>
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className="w-full pl-4 pr-1.5 py-1 text-[11px] text-right border border-[#403770]/30 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 tabular-nums"
          />
        </div>
      </div>
    );
  }

  return (
    <span
      onClick={handleClick}
      className="text-xs text-[#6E6390] text-right tabular-nums pr-2 cursor-pointer hover:text-[#403770] hover:underline decoration-dotted transition-colors"
    >
      {formatCurrency(value)}
    </span>
  );
}

// ─── Sort Header ──────────────────────────────────────────────────

function SortHeader({
  label,
  col,
  activeCol,
  dir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortColumn;
  activeCol: SortColumn;
  dir: "asc" | "desc";
  onSort: (col: SortColumn) => void;
  align?: "left" | "right";
}) {
  const isActive = activeCol === col;

  return (
    <button
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 hover:text-[#544A78] transition-colors ${
        align === "right" ? "justify-end pr-2" : ""
      } ${isActive ? "text-[#544A78]" : ""}`}
    >
      {label}
      {isActive && (
        <svg width="8" height="8" viewBox="0 0 8 8" className={dir === "desc" ? "rotate-180" : ""}>
          <path d="M4 2L6.5 6H1.5L4 2Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}

// ─── Pipeline Stat ────────────────────────────────────────────────

function PipelineStat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-[#6E6390]">
      <span className="text-[#A69DC0]">{label}: </span>
      <span className="font-medium">{formatCurrency(value)}</span>
    </span>
  );
}

// ─── Auto-save Textarea ───────────────────────────────────────────

function AutoSaveTextarea({
  initialValue,
  onSave,
  placeholder,
}: {
  initialValue: string;
  onSave: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      defaultValue={initialValue}
      onBlur={(e) => {
        if (e.target.value !== initialValue) {
          onSave(e.target.value);
        }
      }}
      placeholder={placeholder}
      rows={2}
      className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78] resize-none placeholder:text-[#C2BBD4]"
    />
  );
}

// ─── Add District Button ──────────────────────────────────────────

function AddDistrictButton({
  planId,
  existingLeaids,
}: {
  planId: string;
  existingLeaids: string[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ leaid: string; name: string; stateAbbrev: string }>>([]);
  const [searching, setSearching] = useState(false);
  const addDistricts = useAddDistrictsToPlan();
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
        setResults([]);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/districts?search=${encodeURIComponent(q)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          const items = (data.data || data).filter(
            (d: { leaid: string }) => !existingLeaids.includes(d.leaid)
          );
          setResults(items.slice(0, 8));
        }
      } catch {
        // Silent
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  const handleAdd = async (leaid: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: [leaid] });
      // Remove from results
      setResults((prev) => prev.filter((r) => r.leaid !== leaid));
    } catch {
      // Silent
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] transition-colors"
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 1.5V8.5M1.5 5H8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add District
      </button>

      {open && (
        <div className="absolute bottom-full mb-2 left-0 w-72 bg-white rounded-xl shadow-xl border border-[#D4CFE2] overflow-hidden z-50">
          <div className="px-3 py-2 border-b border-[#E2DEEC]">
            <input
              type="text"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search districts..."
              autoFocus
              className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78] placeholder:text-[#C2BBD4]"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {searching && (
              <div className="px-3 py-4 text-center text-xs text-[#A69DC0]">Searching...</div>
            )}
            {!searching && query && results.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-[#A69DC0]">No districts found</div>
            )}
            {results.map((d) => (
              <button
                key={d.leaid}
                onClick={() => handleAdd(d.leaid)}
                disabled={addDistricts.isPending}
                className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#FAFAFE] transition-colors disabled:opacity-50"
              >
                <div>
                  <span className="text-xs font-medium text-[#544A78]">{d.name}</span>
                  <span className="text-[10px] text-[#A69DC0] ml-1.5">{d.stateAbbrev}</span>
                </div>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-[#A69DC0]">
                  <path d="M5 2V8M2 5H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Browse Map Button ────────────────────────────────────────────

function BrowseMapButton({
  planId,
  onClose,
}: {
  planId: string;
  onClose: () => void;
}) {
  const viewPlan = useMapV2Store((s) => s.viewPlan);

  const handleClick = () => {
    onClose();
    // Navigate to plan add-districts mode on the map
    viewPlan(planId);
  };

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#544A78] border border-[#D4CFE2] hover:border-[#403770]/30 hover:text-[#403770] transition-colors"
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        <path d="M1 3L4.5 1.5L7.5 3L11 1.5V9L7.5 10.5L4.5 9L1 10.5V3Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M4.5 1.5V9M7.5 3V10.5" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      Browse Map
    </button>
  );
}
