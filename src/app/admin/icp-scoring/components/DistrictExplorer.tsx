"use client";

import { Fragment, useState, useMemo, useCallback } from "react";
import type { District } from "../types";
import {
  SectionCard,
  ScoreBar,
  SortArrow,
  TierBadge,
  fmtNum,
  SCORE_BAR_CLASSES,
  LOCALE_MAP,
  SCORE_COLORS,
} from "./shared";
import ClaimButton from "./ClaimButton";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey =
  | "composite_score"
  | "tier"
  | "name"
  | "state"
  | "enrollment"
  | "fit_score"
  | "value_score"
  | "readiness_score"
  | "state_score"
  | "frpl_rate"
  | "chronic_absenteeism"
  | "lifetime_vendor_rev"
  | "is_customer";

type SortDir = "asc" | "desc";

interface ParsedDetails {
  [key: string]: number | string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseDetails(raw: string): ParsedDetails {
  try {
    return JSON.parse(raw) as ParsedDetails;
  } catch {
    return {};
  }
}

function fmtDetailValue(v: number | string | null): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  return fmtNum(v);
}

function exportCSV(data: District[]) {
  const headers = [
    "leaid", "name", "state", "city", "enrollment",
    "composite_score", "tier", "fit_score", "value_score",
    "readiness_score", "state_score", "frpl_rate",
    "chronic_absenteeism", "lifetime_vendor_rev",
    "is_customer", "has_open_pipeline",
  ];
  const rows = data.map((d) =>
    headers
      .map((h) => {
        const v = d[h as keyof District];
        if (v == null) return "";
        if (typeof v === "boolean") return v ? "1" : "0";
        const s = String(v);
        return s.includes(",") || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "districts.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function getSortValue(d: District, key: SortKey): number | string {
  switch (key) {
    case "composite_score": return d.composite_score;
    case "tier": return d.tier;
    case "name": return d.name;
    case "state": return d.state;
    case "enrollment": return d.enrollment ?? -1;
    case "fit_score": return d.fit_score;
    case "value_score": return d.value_score;
    case "readiness_score": return d.readiness_score;
    case "state_score": return d.state_score;
    case "frpl_rate": return d.frpl_rate ?? -1;
    case "chronic_absenteeism": return d.chronic_absenteeism ?? -1;
    case "lifetime_vendor_rev": return d.lifetime_vendor_rev;
    case "is_customer": return d.is_customer ? 1 : 0;
    default: return 0;
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ColHeader({
  label,
  colKey,
  sortKey,
  sortDir,
  onSort,
  width,
  align = "left",
}: {
  label: string;
  colKey: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  width?: string;
  align?: "left" | "right" | "center";
}) {
  const active = sortKey === colKey;
  return (
    <th
      className="px-4 py-3 text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider cursor-pointer hover:text-[#403770] transition-colors duration-100 select-none sticky top-0 z-10 bg-[#F7F5FA]"
      style={{ textAlign: align, width }}
      onClick={() => onSort(colKey)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="inline-flex flex-col gap-px">
          <SortArrow direction="asc" active={active && sortDir === "asc"} />
          <SortArrow direction="desc" active={active && sortDir === "desc"} />
        </span>
      </span>
    </th>
  );
}

function StatusBadge({ d }: { d: District }) {
  if (d.is_customer) {
    return (
      <span className="text-xs font-medium text-[#5f665b] bg-[#EDFFE3] px-1.5 py-0.5 rounded-full whitespace-nowrap">
        Customer
      </span>
    );
  }
  if (d.has_open_pipeline) {
    return (
      <span className="text-xs font-medium text-[#4d7285] bg-[#e8f1f5] px-1.5 py-0.5 rounded-full whitespace-nowrap">
        Pipeline
      </span>
    );
  }
  return (
    <ClaimButton
      leaid={d.leaid}
      districtName={d.name}
      isCustomer={d.is_customer}
      owner={d.owner}
      compact
    />
  );
}

interface DetailColumnProps {
  title: string;
  score: number;
  colorHex: string;
  details: ParsedDetails;
  rawFields: Array<{ label: string; value: string }>;
}

function DetailColumn({ title, score, colorHex, details, rawFields }: DetailColumnProps) {
  const detailEntries = Object.entries(details).filter(([k]) => k !== "score");

  return (
    <div className="flex flex-col gap-1.5">
      <p
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: colorHex }}
      >
        {title}{" "}
        <span className="font-semibold tabular-nums">{score}/100</span>
      </p>
      <div className="flex flex-col gap-0.5">
        {detailEntries.map(([k, v]) => (
          <div key={k} className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-[#8A80A8] capitalize">
              {k.replace(/_/g, " ")}
            </span>
            <span className="text-xs font-medium text-[#544A78] tabular-nums">
              {fmtDetailValue(v)}
            </span>
          </div>
        ))}
      </div>
      {rawFields.length > 0 && (
        <>
          <div className="border-t border-[#E2DEEC] my-1" />
          <div className="flex flex-col gap-0.5">
            {rawFields.map(({ label, value }) => (
              <div key={label} className="flex items-baseline justify-between gap-2">
                <span className="text-xs text-[#8A80A8]">{label}</span>
                <span className="text-xs text-[#544A78] font-medium tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExpandedRow({ d, colSpan }: { d: District; colSpan: number }) {
  const fitDetails = parseDetails(d.fit_details);
  const valueDetails = parseDetails(d.value_details);
  const readinessDetails = parseDetails(d.readiness_details);
  const stateDetails = parseDetails(d.state_details);

  const localeLabel = d.locale_code != null ? LOCALE_MAP[d.locale_code] ?? String(d.locale_code) : "—";

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-[#F7F5FA] border-t border-[#E2DEEC] px-6 py-4">
          <div className="grid grid-cols-4 gap-6">
            <DetailColumn
              title="Fit"
              score={d.fit_score}
              colorHex={SCORE_COLORS.fit}
              details={fitDetails}
              rawFields={[
                { label: "Locale", value: localeLabel },
                { label: "Schools", value: d.number_of_schools != null ? String(d.number_of_schools) : "—" },
                { label: "S:T Ratio", value: d.student_teacher_ratio != null ? fmtNum(d.student_teacher_ratio) : "—" },
              ]}
            />
            <DetailColumn
              title="Value"
              score={d.value_score}
              colorHex={SCORE_COLORS.value}
              details={valueDetails}
              rawFields={[
                { label: "Vendor $", value: fmtNum(d.lifetime_vendor_rev, { dollar: true }) },
                { label: "Vendors", value: String(d.vendor_count) },
                { label: "Exp/Pupil", value: d.expenditure_per_pupil != null ? fmtNum(d.expenditure_per_pupil, { dollar: true }) : "—" },
              ]}
            />
            <DetailColumn
              title="Readiness"
              score={d.readiness_score}
              colorHex={SCORE_COLORS.readiness}
              details={readinessDetails}
              rawFields={[
                { label: "Enroll Trend", value: d.enrollment_trend_3yr != null ? fmtNum(d.enrollment_trend_3yr, { pct: true }) : "—" },
                { label: "Staffing Trend", value: d.staffing_trend_3yr != null ? fmtNum(d.staffing_trend_3yr, { pct: true }) : "—" },
                { label: "Math Prof", value: d.math_proficiency != null ? fmtNum(d.math_proficiency, { pct: true }) : "—" },
                { label: "Read Prof", value: d.read_proficiency != null ? fmtNum(d.read_proficiency, { pct: true }) : "—" },
              ]}
            />
            <DetailColumn
              title="State"
              score={d.state_score}
              colorHex={SCORE_COLORS.state}
              details={stateDetails}
              rawFields={[
                { label: "Charter Pay", value: d.charter_payments != null ? fmtNum(d.charter_payments, { dollar: true }) : "—" },
                { label: "Private Pay", value: d.private_payments != null ? fmtNum(d.private_payments, { dollar: true }) : "—" },
                { label: "Grad Rate", value: d.graduation_rate != null ? fmtNum(d.graduation_rate, { pct: true }) : "—" },
              ]}
            />
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DistrictExplorer({ data }: { data: District[] }) {
  // Sort state
  const [sortKey, setSortKey] = useState<SortKey>("composite_score");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filter state
  const [tierFilter, setTierFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Expand state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Available states
  const availableStates = useMemo(
    () =>
      Array.from(new Set(data.map((d) => d.state).filter(Boolean))).sort(),
    [data]
  );

  // Filtering
  const filtered = useMemo(() => {
    let result = data;

    if (tierFilter !== "all") {
      result = result.filter((d) => d.tier === tierFilter);
    }
    if (stateFilter !== "all") {
      result = result.filter((d) => d.state === stateFilter);
    }
    if (customerFilter === "customer") {
      result = result.filter((d) => d.is_customer);
    } else if (customerFilter === "pipeline") {
      result = result.filter((d) => d.has_open_pipeline && !d.is_customer);
    } else if (customerFilter === "prospect") {
      result = result.filter((d) => !d.is_customer && !d.has_open_pipeline);
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.state.toLowerCase().includes(q) ||
          (d.city ?? "").toLowerCase().includes(q)
      );
    }

    return result;
  }, [data, tierFilter, stateFilter, customerFilter, search]);

  // Sorting
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = getSortValue(a, sortKey);
      const bv = getSortValue(b, sortKey);
      if (typeof av === "string" && typeof bv === "string") {
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = av as number;
      const bn = bv as number;
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [filtered, sortKey, sortDir]);

  // Pagination
  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startRow = (safePage - 1) * pageSize;
  const endRow = Math.min(startRow + pageSize, total);
  const paged = sorted.slice(startRow, endRow);

  // Derived
  const hasActiveFilters =
    tierFilter !== "all" ||
    stateFilter !== "all" ||
    customerFilter !== "all" ||
    search.trim() !== "";

  // Handlers
  const handleSort = useCallback(
    (key: SortKey) => {
      if (sortKey === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortKey(key);
        setSortDir("desc");
      }
      setPage(1);
    },
    [sortKey]
  );

  const handleClearFilters = useCallback(() => {
    setTierFilter("all");
    setStateFilter("all");
    setCustomerFilter("all");
    setSearch("");
    setPage(1);
  }, []);

  const handleRowClick = useCallback((leaid: string) => {
    setExpandedId((prev) => (prev === leaid ? null : leaid));
  }, []);

  const colHeaderProps = { sortKey, sortDir, onSort: handleSort };

  const selectCls =
    "flex-1 px-3 py-1.5 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none";

  const COL_COUNT = 13;

  return (
    <SectionCard
      title="District Explorer"
      description="Search, filter, and drill into any district"
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Search */}
        <input
          type="search"
          placeholder="Search districts…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 max-w-xs px-3 py-1.5 text-sm text-[#6E6390] placeholder:text-[#A69DC0] border border-[#C2BBD4] rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
          aria-label="Search districts"
        />

        {/* Tier select */}
        <select
          value={tierFilter}
          onChange={(e) => { setTierFilter(e.target.value); setPage(1); }}
          className={selectCls}
          aria-label="Filter by tier"
        >
          <option value="all">All Tiers</option>
          <option value="Tier 1">Tier 1</option>
          <option value="Tier 2">Tier 2</option>
          <option value="Tier 3">Tier 3</option>
          <option value="Tier 4">Tier 4</option>
        </select>

        {/* State select */}
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
          className={selectCls}
          aria-label="Filter by state"
        >
          <option value="all">All States</option>
          {availableStates.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Status select */}
        <select
          value={customerFilter}
          onChange={(e) => { setCustomerFilter(e.target.value); setPage(1); }}
          className={selectCls}
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="customer">Customer</option>
          <option value="pipeline">Pipeline</option>
          <option value="prospect">Prospect</option>
        </select>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="text-xs font-medium text-[#403770] hover:underline whitespace-nowrap"
          >
            Clear filters
          </button>
        )}

        {/* Export CSV — right aligned */}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => exportCSV(sorted)}
            className="px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] transition-colors duration-100 whitespace-nowrap"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Table card */}
      <div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm flex flex-col">
        {/* Empty filtered state */}
        {filtered.length === 0 && hasActiveFilters ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <svg
              className="w-8 h-8 text-[#C2BBD4]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 4h18M6 8h12M9 12h6M11 16h2"
              />
            </svg>
            <p className="text-sm font-medium text-[#8A80A8]">No matching results</p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="text-xs font-medium text-[#403770] hover:underline"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Scroll container */}
            <div className="overflow-auto">
              <table
                role="grid"
                aria-rowcount={total}
                aria-colcount={COL_COUNT}
                className="min-w-full"
              >
                <thead>
                  <tr>
                    <ColHeader label="Score" colKey="composite_score" width="70px" align="right" {...colHeaderProps} />
                    <ColHeader label="Tier" colKey="tier" width="70px" {...colHeaderProps} />
                    <ColHeader label="District" colKey="name" width="200px" {...colHeaderProps} />
                    <ColHeader label="ST" colKey="state" width="50px" {...colHeaderProps} />
                    <ColHeader label="Enroll" colKey="enrollment" width="80px" align="right" {...colHeaderProps} />
                    <ColHeader label="Fit" colKey="fit_score" width="140px" {...colHeaderProps} />
                    <ColHeader label="Value" colKey="value_score" width="140px" {...colHeaderProps} />
                    <ColHeader label="Ready" colKey="readiness_score" width="140px" {...colHeaderProps} />
                    <ColHeader label="State" colKey="state_score" width="140px" {...colHeaderProps} />
                    <ColHeader label="FRPL%" colKey="frpl_rate" width="65px" align="right" {...colHeaderProps} />
                    <ColHeader label="Abs%" colKey="chronic_absenteeism" width="65px" align="right" {...colHeaderProps} />
                    <ColHeader label="Vendor$" colKey="lifetime_vendor_rev" width="90px" align="right" {...colHeaderProps} />
                    <ColHeader label="Status" colKey="is_customer" width="130px" {...colHeaderProps} />
                  </tr>
                </thead>
                <tbody>
                  {paged.map((d) => {
                    const isExpanded = expandedId === d.leaid;
                    return (
                      <Fragment key={d.leaid}>
                        <tr
                          className={`border-t border-[#E2DEEC] cursor-pointer transition-colors duration-75 ${
                            isExpanded
                              ? "bg-[#C4E7E6]/15"
                              : "hover:bg-[#EFEDF5]"
                          }`}
                          onClick={() => handleRowClick(d.leaid)}
                          aria-expanded={isExpanded}
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleRowClick(d.leaid);
                            }
                          }}
                        >
                          {/* Score */}
                          <td className="px-4 py-3 text-sm text-right tabular-nums font-bold text-[#F37167]">
                            {d.composite_score}
                          </td>
                          {/* Tier */}
                          <td className="px-4 py-3">
                            <TierBadge tier={d.tier} />
                          </td>
                          {/* District */}
                          <td className="px-4 py-3" style={{ minWidth: 200 }}>
                            <p className="text-sm font-medium text-[#403770] truncate max-w-[240px]">
                              {d.name}
                            </p>
                            {d.city && (
                              <p className="text-xs text-[#A69DC0] truncate max-w-[240px]">
                                {d.city}
                              </p>
                            )}
                          </td>
                          {/* State */}
                          <td className="px-4 py-3 text-sm text-[#6E6390]">
                            {d.state}
                          </td>
                          {/* Enrollment */}
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-[#6E6390]">
                            {fmtNum(d.enrollment, { compact: true })}
                          </td>
                          {/* Fit */}
                          <td className="px-4 py-3">
                            <ScoreBar value={d.fit_score} color={SCORE_BAR_CLASSES.fit} />
                          </td>
                          {/* Value */}
                          <td className="px-4 py-3">
                            <ScoreBar value={d.value_score} color={SCORE_BAR_CLASSES.value} />
                          </td>
                          {/* Readiness */}
                          <td className="px-4 py-3">
                            <ScoreBar value={d.readiness_score} color={SCORE_BAR_CLASSES.readiness} />
                          </td>
                          {/* State score */}
                          <td className="px-4 py-3">
                            <ScoreBar value={d.state_score} color={SCORE_BAR_CLASSES.state} />
                          </td>
                          {/* FRPL% */}
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-[#6E6390]">
                            {fmtNum(d.frpl_rate, { pct: true })}
                          </td>
                          {/* Abs% */}
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-[#6E6390]">
                            {fmtNum(d.chronic_absenteeism, { pct: true })}
                          </td>
                          {/* Vendor$ */}
                          <td className="px-4 py-3 text-sm text-right tabular-nums text-[#6E6390]">
                            {fmtNum(d.lifetime_vendor_rev, { dollar: true })}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <StatusBadge d={d} />
                          </td>
                        </tr>
                        {isExpanded && (
                          <ExpandedRow d={d} colSpan={COL_COUNT} />
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA]">
              <p
                className="text-xs text-[#8A80A8]"
                aria-live="polite"
                aria-atomic="true"
              >
                Showing{" "}
                <span className="font-medium text-[#6E6390] tabular-nums">
                  {total === 0 ? 0 : startRow + 1}–{endRow}
                </span>{" "}
                of{" "}
                <span className="font-medium text-[#6E6390] tabular-nums">
                  {total}
                </span>{" "}
                districts
              </p>
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-1 mt-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#D4CFE2] text-[#6E6390] hover:text-[#403770] hover:border-[#8A80A8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
          >
            Previous
          </button>

          <div className="flex items-center gap-3">
            <span className="text-[12px] text-[#8A80A8] font-medium tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="text-[12px] border border-[#D4CFE2] rounded-lg px-2 py-1 text-[#6E6390] bg-white focus-visible:outline-none"
              aria-label="Rows per page"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-3 py-1.5 text-[13px] font-medium rounded-lg border border-[#D4CFE2] text-[#6E6390] hover:text-[#403770] hover:border-[#8A80A8] disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-100"
          >
            Next
          </button>
        </div>
      )}
    </SectionCard>
  );
}
