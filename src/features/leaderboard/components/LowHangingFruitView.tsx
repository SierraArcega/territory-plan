"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowUpRight, Check, ChevronDown, ChevronUp, Plus } from "lucide-react";
import { useLowHangingFruitList } from "../lib/queries";
import type { IncreaseTarget, IncreaseTargetCategory } from "../lib/types";
import { formatCurrencyShort, getInitials } from "../lib/format";
import {
  DEFAULT_FILTERS,
  applyFilters,
  type LHFFilters,
} from "../lib/filters";
import LowHangingFruitFilterBar from "./LowHangingFruitFilterBar";
import LhfPlanPicker from "./LhfPlanPicker";
import LhfBulkPlanPicker from "./LhfBulkPlanPicker";

const LMS_OPP_CREATE_URL =
  "https://lms.fullmindlearning.com/opportunities/kanban?_sort=close_date&_dir=asc&school_year=2026-27";

const CATEGORY_LABEL: Record<IncreaseTargetCategory, string> = {
  missing_renewal: "Missing renewal",
  fullmind_winback: "Fullmind winback",
  ek12_winback: "EK12 winback",
};
const CATEGORY_COLORS: Record<
  IncreaseTargetCategory,
  { bg: string; fg: string; dot: string }
> = {
  missing_renewal: { bg: "#FEF2F1", fg: "#B5453D", dot: "#F37167" },
  fullmind_winback: { bg: "#EFEDF5", fg: "#403770", dot: "#403770" },
  ek12_winback: { bg: "#FDEEE8", fg: "#7C3A21", dot: "#E07A5F" },
};
const CATEGORY_PRIORITY: Record<IncreaseTargetCategory, number> = {
  missing_renewal: 0,
  fullmind_winback: 1,
  ek12_winback: 2,
};
const CONFIRMATION_HOLD_MS = 2200;

function heroRevenue(r: IncreaseTarget): number {
  return r.category === "missing_renewal" ? r.fy26Revenue : r.priorYearRevenue;
}

// Most recent prior-year revenue + the FY label, regardless of category.
// Winback rows already get this via priorYearRevenue/priorYearFy. Missing-
// renewal rows have FY25/FY24 fullmind revenue in revenueTrend; surface
// the most recent non-zero entry so reps can see growth vs. shrinkage.
function priorRevenue(r: IncreaseTarget): { amount: number; fy: string | null } {
  if (r.priorYearRevenue > 0) {
    return { amount: r.priorYearRevenue, fy: r.priorYearFy };
  }
  const t = r.revenueTrend;
  if (t.fy25 != null && t.fy25 > 0) return { amount: t.fy25, fy: "FY25" };
  if (t.fy24 != null && t.fy24 > 0) return { amount: t.fy24, fy: "FY24" };
  return { amount: 0, fy: null };
}

function fmtMonthYear(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function sortByCategoryThenRevenue(rows: IncreaseTarget[]): IncreaseTarget[] {
  return [...rows].sort((a, b) => {
    const c = CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category];
    if (c !== 0) return c;
    return heroRevenue(b) - heroRevenue(a);
  });
}

function buildCsv(rows: IncreaseTarget[]): string {
  const headers = [
    "District",
    "State",
    "Category",
    "Prior revenue",
    "Prior FY",
    "FY26 revenue",
    "FY26 closed won",
    "FY27 pipeline",
    "FY27 target",
    "FY27 target reps",
    "Suggested target",
    "Last rep",
    "Last close date",
  ];
  const csvRows = rows.map((r) => {
    const p = priorRevenue(r);
    return [
      r.districtName,
      r.state,
      CATEGORY_LABEL[r.category],
      p.amount > 0 ? Math.round(p.amount) : "",
      p.fy ?? "",
      r.category === "missing_renewal" ? Math.round(r.fy26Revenue) : "",
      Math.round(r.fy26OppBookings),
      Math.round(r.fy27OpenPipeline),
      r.fy27TargetAmount > 0 ? Math.round(r.fy27TargetAmount) : "",
      r.fy27TargetReps.join("; "),
      r.suggestedTarget != null ? Math.round(r.suggestedTarget) : "",
      r.lastClosedWon?.repName ?? "",
      r.lastClosedWon?.closeDate ?? "",
    ];
  });
  const escape = (v: string | number) => {
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [headers, ...csvRows]
    .map((row) => row.map(escape).join(","))
    .join("\n");
}

function downloadCsv(rows: IncreaseTarget[]) {
  const csv = buildCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `low-hanging-fruit-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CategoryPill({ category }: { category: IncreaseTargetCategory }) {
  const c = CATEGORY_COLORS[category];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} aria-hidden />
      {CATEGORY_LABEL[category]}
    </span>
  );
}

function RepAvatar({ name }: { name: string | null }) {
  if (!name) {
    return (
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded-full border border-dashed border-[#C2BBD4] bg-[#EFEDF5] text-[#A69DC0] text-[9px]"
        aria-hidden
      >
        ?
      </span>
    );
  }
  const initials = getInitials(name).toUpperCase();
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#403770] text-white text-[9px] font-semibold shrink-0"
      aria-hidden
    >
      {initials}
    </span>
  );
}

interface RowActionsProps {
  district: IncreaseTarget;
  isConfirmed: boolean;
  confirmedPlanLabel: string;
  onAdded: (planName: string) => void;
}
function RowActions({ district, isConfirmed, confirmedPlanLabel, onAdded }: RowActionsProps) {
  const planBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isConfirmed) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#69B34A] whitespace-nowrap">
        <Check className="w-3.5 h-3.5" />
        Added to {confirmedPlanLabel}
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <a
        href={LMS_OPP_CREATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        title="Create opportunity in LMS (opens new tab)"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#C2BBD4] text-xs font-semibold text-[#403770] bg-white hover:bg-[#F7F5FA] whitespace-nowrap"
      >
        + Opp <ArrowUpRight className="w-3 h-3" />
      </a>
      <button
        ref={planBtnRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPickerOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] whitespace-nowrap"
      >
        <Plus className="w-3 h-3" />
        Plan
        <ChevronDown className="w-2.5 h-2.5 opacity-80" />
      </button>
      {pickerOpen && (
        <LhfPlanPicker
          district={district}
          anchorRef={planBtnRef}
          isOpen={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSuccess={(planName) => {
            setPickerOpen(false);
            onAdded(planName);
          }}
        />
      )}
    </div>
  );
}

export default function LowHangingFruitView() {
  const query = useLowHangingFruitList();
  const [filters, setFilters] = useState<LHFFilters>(DEFAULT_FILTERS);
  const [confirmed, setConfirmed] = useState<{ leaid: string; planName: string } | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
  const bulkBtnRef = useRef<HTMLButtonElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [bannerCollapsed, setBannerCollapsed] = useState(() =>
    typeof window !== "undefined" &&
    sessionStorage.getItem("lhf-banner-collapsed") === "true"
  );

  const toggleBanner = () => {
    setBannerCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem("lhf-banner-collapsed", String(next));
      return next;
    });
  };

  const [filtersCollapsed, setFiltersCollapsed] = useState(() =>
    typeof window !== "undefined" &&
    sessionStorage.getItem("lhf-filters-collapsed") === "true"
  );

  const toggleFilters = () => {
    setFiltersCollapsed((prev) => {
      const next = !prev;
      sessionStorage.setItem("lhf-filters-collapsed", String(next));
      return next;
    });
  };

  const activeFilterCount =
    filters.categories.length +
    filters.states.length +
    filters.products.length +
    (filters.revenueBand ? 1 : 0) +
    filters.lastReps.length;

  const allRows = query.data?.districts ?? [];

  const facets = useMemo(() => {
    const counts: Record<IncreaseTargetCategory, number> = {
      missing_renewal: 0,
      fullmind_winback: 0,
      ek12_winback: 0,
    };
    const stateCounts: Record<string, number> = {};
    const products = new Set<string>();
    const reps = new Set<string>();
    for (const r of allRows) {
      counts[r.category]++;
      if (r.state) stateCounts[r.state] = (stateCounts[r.state] ?? 0) + 1;
      for (const p of r.productTypes) products.add(p);
      const rep = r.lastClosedWon?.repName;
      if (rep) reps.add(rep);
    }
    return {
      categoryCounts: counts,
      states: Object.keys(stateCounts).sort(),
      stateCounts,
      products: [...products].sort(),
      reps: [...reps].sort((a, b) => a.localeCompare(b)),
    };
  }, [allRows]);

  const filtered = useMemo(
    () => sortByCategoryThenRevenue(applyFilters(allRows, filters)),
    [allRows, filters],
  );

  const totalRevenue = useMemo(
    () => filtered.reduce((s, r) => s + heroRevenue(r), 0),
    [filtered],
  );

  const fireConfirmation = (leaid: string, planName: string) => {
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmed({ leaid, planName });
    confirmTimer.current = setTimeout(() => {
      setConfirmed(null);
      confirmTimer.current = null;
    }, CONFIRMATION_HOLD_MS);
  };

  const stripPrefix = (name: string) => name.replace(/^FY27\s*[·:|-]\s*/i, "");

  const fireToast = (msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3000);
  };

  const toggleSelect = (leaid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) next.delete(leaid);
      else next.add(leaid);
      return next;
    });
  };

  // Header checkbox: deselects all if every visible row is selected, else
  // adds every visible row to the selection (additive across paginated views).
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.leaid));
  const toggleSelectAllVisible = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const r of filtered) next.delete(r.leaid);
      } else {
        for (const r of filtered) next.add(r.leaid);
      }
      return next;
    });
  };

  const selectedRows = useMemo(
    () => allRows.filter((r) => selected.has(r.leaid)),
    [allRows, selected],
  );
  const selectedTotal = useMemo(
    () => selectedRows.reduce((s, r) => s + heroRevenue(r), 0),
    [selectedRows],
  );

  return (
    <div className="h-full bg-[#FFFCFA] overflow-hidden flex flex-col p-6">
      <div
        className="flex flex-col flex-1 min-h-0 rounded-xl border border-[#D4CFE2] bg-[#FFFCFA] overflow-hidden"
      >
        {/* Header */}
        <header className="flex-shrink-0 flex flex-wrap items-end justify-between gap-3 px-5 py-4 bg-white border-b border-[#E2DEEC]">
          <div>
            <h1 className="text-lg font-bold text-[#403770]">Low hanging fruit</h1>
            <p className="text-xs text-[#6E6390] mt-1">
              Showing{" "}
              <strong className="text-[#403770] font-semibold tabular-nums">
                {filtered.length}
              </strong>{" "}
              of <span className="tabular-nums">{allRows.length}</span> districts
              {" · "}
              <span className="tabular-nums">
                {formatCurrencyShort(query.data?.totalRevenueAtRisk ?? 0)}
              </span>{" "}
              FY26 revenue unclaimed
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadCsv(filtered)}
            disabled={filtered.length === 0}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4CFE2] text-[#6E6390] bg-white hover:bg-[#F7F5FA] disabled:opacity-50"
          >
            Export CSV
          </button>
        </header>

        {/* Summary banner */}
        {bannerCollapsed ? (
          <button
            type="button"
            onClick={toggleBanner}
            className="flex-shrink-0 flex items-center justify-between px-5 py-2 bg-[#F7F5FA] border-b border-[#E2DEEC] w-full text-left"
            aria-expanded={false}
            aria-label="Show instructions"
          >
            <span className="text-[11px] font-semibold text-[#6E6390]">Instructions</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8]" />
          </button>
        ) : (
          <div className="flex-shrink-0 px-5 py-3.5 bg-[#F7F5FA] border-b border-[#E2DEEC]">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-xs text-[#544A78] leading-relaxed">
                  You&apos;ll find 3 buckets of customers on this page:{" "}
                  <strong className="text-[#403770]">Missing Renewals</strong>,{" "}
                  <strong className="text-[#403770]">Fullmind Winbacks</strong>, and{" "}
                  <strong className="text-[#403770]">Elevate Winbacks</strong>.{" "}
                  All Winbacks are first-come, first-serve — it doesn&apos;t matter if you were the original rep or if the customer is from your company of origin.
                  Grab any winback that looks exciting and fits into the goals you have for your Book of Business!
                </p>
                <p className="text-xs text-[#544A78] mt-2">
                  <strong className="text-[#403770]">How to action them:</strong>{" "}
                  Click the <strong className="text-[#403770]">+Opp</strong> button to jump straight into the LMS and create the opportunity, or add to a plan and set a target.
                </p>
                <ul className="text-xs text-[#544A78] mt-1.5 space-y-0.5 list-disc pl-5">
                  <li>
                    <strong className="text-[#403770]">Missing Renewals</strong> leave this list once an FY27 opp exists — renewals are required to have an FY27 opportunity, so <strong className="text-[#403770]">+Opp</strong> is the path.
                  </li>
                  <li>
                    <strong className="text-[#403770]">Winbacks</strong> leave this list when an FY27 opp is created <em>or</em> a plan target is set.
                  </li>
                </ul>
              </div>
              <button
                type="button"
                onClick={toggleBanner}
                className="flex-shrink-0 text-[#8A80A8] hover:text-[#403770] mt-0.5"
                aria-expanded={true}
                aria-label="Hide instructions"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Filter bar */}
        {filtersCollapsed ? (
          <button
            type="button"
            onClick={toggleFilters}
            className="flex-shrink-0 flex items-center justify-between px-5 py-2 bg-white border-b border-[#E2DEEC] w-full text-left"
            aria-expanded={false}
            aria-label="Show filters"
          >
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#6E6390]">Filters</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white bg-[#403770]">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#8A80A8]" />
          </button>
        ) : (
          <div className="flex-shrink-0 relative">
            <LowHangingFruitFilterBar
              filters={filters}
              facets={facets}
              onChange={setFilters}
            />
            <button
              type="button"
              onClick={toggleFilters}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8A80A8] hover:text-[#403770]"
              aria-expanded={true}
              aria-label="Hide filters"
            >
              <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto bg-white">
          {query.isLoading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 bg-[#F7F5FA] rounded-lg animate-pulse" />
              ))}
            </div>
          ) : query.isError ? (
            <div className="m-6 px-3 py-2 rounded-lg bg-[#fef1f0] border border-[#f58d85] flex items-center justify-between gap-3">
              <span className="text-xs text-[#544A78]">Couldn&apos;t load the list.</span>
              <button
                className="text-xs font-semibold text-[#403770] hover:underline"
                onClick={() => query.refetch()}
              >
                Retry
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div>
                <p className="text-sm text-[#6E6390] mb-2">
                  {allRows.length === 0
                    ? "Every FY26 customer has FY27 activity. Nothing to claim right now."
                    : "No districts match these filters."}
                </p>
                {allRows.length > 0 && (
                  <button
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="text-xs font-semibold text-[#403770] hover:underline"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          ) : (
            <table className="w-full border-collapse text-sm tabular-nums">
              <thead className="sticky top-0 z-10 bg-[#F7F5FA]">
                <tr className="border-b border-[#D4CFE2]">
                  <Th width={36} className="pl-4 pr-2">
                    <input
                      type="checkbox"
                      aria-label={allVisibleSelected ? "Deselect all visible" : "Select all visible"}
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="w-3.5 h-3.5 rounded"
                      style={{ accentColor: "#403770" }}
                    />
                  </Th>
                  <Th minWidth={220}>District</Th>
                  <Th width={50}>St</Th>
                  <Th width={140}>Category</Th>
                  <Th width={92} align="right">Prior rev.</Th>
                  <Th width={92} align="right">FY26 rev.</Th>
                  <Th width={108} align="right">FY26 closed won</Th>
                  <Th width={108} align="right">FY27 pipeline</Th>
                  <Th width={96} align="right">FY27 target</Th>
                  <Th width={96} align="right">Suggested</Th>
                  <Th width={184}>Last sale</Th>
                  <Th
                    width={208}
                    align="right"
                    className="px-3 sticky right-0 bg-[#F7F5FA]"
                    style={{ boxShadow: "-4px 0 6px -2px rgba(0,0,0,0.05)" }}
                  />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, idx) => {
                  const isConfirmed = confirmed?.leaid === r.leaid;
                  const isSelected = selected.has(r.leaid);
                  const isLast = idx === filtered.length - 1;
                  const lcw = r.lastClosedWon;
                  const rowBg = isConfirmed ? "#EDFFE3" : isSelected ? "#EFEDF5" : undefined;
                  const stickyBg = isConfirmed ? "#EDFFE3" : isSelected ? "#EFEDF5" : "white";
                  return (
                    <tr
                      key={r.leaid}
                      className="group hover:bg-[#F7F5FA] cursor-pointer"
                      style={{
                        background: rowBg,
                        transition: "background 100ms",
                        borderBottom: isLast ? undefined : "1px solid #E2DEEC",
                      }}
                    >
                      <Td className="pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.leaid)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Select ${r.districtName}`}
                          className="w-3.5 h-3.5 rounded"
                          style={{ accentColor: "#403770" }}
                        />
                      </Td>
                      <Td>
                        <div className="font-semibold text-[#403770] whitespace-nowrap">
                          {r.districtName}
                        </div>
                        <div className="text-xs text-[#A69DC0] mt-0.5 whitespace-nowrap">
                          {r.enrollment != null ? `${r.enrollment.toLocaleString()} enrolled` : "—"}
                          {r.fy26SessionCount != null && r.fy26SessionCount > 0 && (
                            <> · {r.fy26SessionCount.toLocaleString()} sessions</>
                          )}
                        </div>
                      </Td>
                      <Td className="text-[#8A80A8] font-semibold whitespace-nowrap">
                        {r.state}
                      </Td>
                      <Td>
                        <CategoryPill category={r.category} />
                      </Td>
                      <Td
                        align="right"
                        className={
                          priorRevenue(r).amount > 0
                            ? "font-bold text-[#403770]"
                            : "text-[#A69DC0]"
                        }
                      >
                        {(() => {
                          const p = priorRevenue(r);
                          if (p.amount <= 0) return "—";
                          return (
                            <>
                              {formatCurrencyShort(p.amount)}
                              {p.fy && (
                                <div className="text-[10px] font-normal text-[#A69DC0]">
                                  {p.fy}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.category === "missing_renewal"
                            ? "font-bold text-[#403770]"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.category === "missing_renewal"
                          ? formatCurrencyShort(r.fy26Revenue)
                          : "—"}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.fy26OppBookings > 0
                            ? "text-[#403770] font-semibold"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.fy26OppBookings > 0 ? formatCurrencyShort(r.fy26OppBookings) : "—"}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.fy27OpenPipeline > 0
                            ? "text-[#6EA3BE] font-semibold"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.fy27OpenPipeline > 0 ? formatCurrencyShort(r.fy27OpenPipeline) : "—"}
                      </Td>
                      <Td
                        align="right"
                        className={
                          r.fy27TargetAmount > 0
                            ? "font-bold text-[#403770]"
                            : "text-[#A69DC0]"
                        }
                      >
                        {r.fy27TargetAmount > 0 ? (
                          <>
                            {formatCurrencyShort(r.fy27TargetAmount)}
                            {r.fy27TargetReps.length > 0 && (
                              <div
                                className="text-[10px] font-normal text-[#A69DC0] truncate"
                                title={r.fy27TargetReps.join(", ")}
                              >
                                {r.fy27TargetReps[0]}
                                {r.fy27TargetReps.length > 1 &&
                                  ` +${r.fy27TargetReps.length - 1}`}
                              </div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td align="right" className="text-[#6E6390]">
                        {r.suggestedTarget != null ? formatCurrencyShort(r.suggestedTarget) : "—"}
                      </Td>
                      <Td>
                        {lcw ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <RepAvatar name={lcw.repName} />
                            <div className="min-w-0">
                              <div className="text-xs text-[#403770] truncate">
                                {lcw.repName ?? "—"}
                              </div>
                              <div className="text-xs text-[#A69DC0] whitespace-nowrap">
                                {fmtMonthYear(lcw.closeDate)}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-[#A69DC0] italic">No prior rep</span>
                        )}
                      </Td>
                      <td
                        className="py-2 px-3 align-middle text-right sticky right-0"
                        style={{
                          background: stickyBg,
                          boxShadow: "-4px 0 6px -2px rgba(0,0,0,0.05)",
                        }}
                      >
                        <RowActions
                          district={r}
                          isConfirmed={isConfirmed}
                          confirmedPlanLabel={
                            isConfirmed ? stripPrefix(confirmed.planName) : ""
                          }
                          onAdded={(planName) => fireConfirmation(r.leaid, planName)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F7F5FA] border-t border-[#E2DEEC] text-xs text-[#8A80A8]">
          <span>
            <span className="tabular-nums">{filtered.length}</span> districts
          </span>
          <span>
            FY26 unclaimed:{" "}
            <strong className="text-[#403770] font-semibold tabular-nums">
              {formatCurrencyShort(totalRevenue)}
            </strong>
          </span>
        </div>
      </div>

      {/* Bulk-action toolbar — appears when one or more rows are selected */}
      {selected.size > 0 && (
        <div className="flex-shrink-0 mt-3 flex items-center justify-between gap-3 rounded-xl px-4 py-3 bg-[#403770] text-white shadow-lg">
          <span className="text-sm whitespace-nowrap">
            <span className="tabular-nums font-semibold">{selected.size}</span> selected
            {" · "}
            <span className="tabular-nums">{formatCurrencyShort(selectedTotal)}</span> total
          </span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="text-xs hover:underline"
            >
              Clear
            </button>
            <button
              ref={bulkBtnRef}
              type="button"
              onClick={() => setBulkPickerOpen((v) => !v)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#403770] bg-white hover:bg-[#EFEDF5] whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              Add {selected.size} to plan
              <ChevronDown className="w-2.5 h-2.5 opacity-80" />
            </button>
          </div>
          {bulkPickerOpen && (
            <LhfBulkPlanPicker
              districts={selectedRows}
              anchorRef={bulkBtnRef}
              isOpen={bulkPickerOpen}
              onClose={() => setBulkPickerOpen(false)}
              onSuccess={(planName, addedCount) => {
                setBulkPickerOpen(false);
                setSelected(new Set());
                fireToast(
                  `Added ${addedCount} ${addedCount === 1 ? "district" : "districts"} to ${stripPrefix(planName)}`,
                );
              }}
            />
          )}
        </div>
      )}

      {/* Toast — bulk-add success message */}
      {toast && (
        <div
          role="status"
          className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg bg-[#EDFFE3] border border-[#8AC670] text-xs text-[#544A78] shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell helpers
// ---------------------------------------------------------------------------

interface ThProps {
  children?: React.ReactNode;
  width?: number;
  minWidth?: number;
  align?: "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}
function Th({ children, width, minWidth, align = "left", className = "", style }: ThProps) {
  return (
    <th
      className={`px-3 py-2.5 text-[10px] font-bold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
      style={{
        width: width ? `${width}px` : undefined,
        minWidth: (minWidth ?? width) ? `${minWidth ?? width}px` : undefined,
        ...style,
      }}
      scope="col"
    >
      {children}
    </th>
  );
}

interface TdProps {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}
function Td({ children, align = "left", className = "" }: TdProps) {
  return (
    <td
      className={`py-2 px-3 align-middle text-sm ${
        align === "right" ? "text-right" : "text-left"
      } ${className}`}
    >
      {children}
    </td>
  );
}
