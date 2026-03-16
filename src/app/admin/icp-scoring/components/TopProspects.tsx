"use client";

import { useMemo, useState, useCallback } from "react";
import type { District } from "../types";
import {
  SectionCard,
  TierBadge,
  fmtNum,
  SCORE_COLORS,
} from "./shared";
import ClaimButton from "./ClaimButton";

/** SVG donut showing 4 sub-scores as arcs with composite in the center */
function ScoreDonut({ fit, value, readiness, state, composite, size = 48 }: {
  fit: number; value: number; readiness: number; state: number; composite: number; size?: number;
}) {
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const segments = [
    { score: fit, color: SCORE_COLORS.fit },
    { score: value, color: SCORE_COLORS.value },
    { score: readiness, color: SCORE_COLORS.readiness },
    { score: state, color: SCORE_COLORS.state },
  ];
  const total = segments.reduce((s, seg) => s + seg.score, 0);
  let offset = -circumference / 4;

  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#EFEDF5" strokeWidth={strokeWidth} />
      {segments.map(({ score, color }, i) => {
        const segLen = total > 0 ? (score / total) * circumference : 0;
        const arcLen = Math.max(0, segLen - 2);
        const el = (
          <circle key={i} cx={center} cy={center} r={radius} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeDasharray={`${arcLen} ${circumference - arcLen}`}
            strokeDashoffset={-offset} strokeLinecap="round" />
        );
        offset += segLen;
        return el;
      })}
      <text x={center} y={center + 1} textAnchor="middle" dominantBaseline="central"
        className="font-bold fill-[#544A78]" style={{ fontSize: 13 }}>
        {composite}
      </text>
    </svg>
  );
}

function ProspectCard({ d }: { d: District }) {
  const cityState = [d.city, d.state].filter(Boolean).join(", ");
  const enrollmentLabel = d.enrollment != null
    ? `${fmtNum(d.enrollment, { compact: true })} enrollment`
    : null;
  const subtitle = [cityState, enrollmentLabel].filter(Boolean).join(" · ");

  const pills: string[] = [];
  if (d.frpl_rate != null) pills.push(`${d.frpl_rate.toFixed(0)}% FP`);
  if (d.enrollment != null) pills.push(`${fmtNum(d.enrollment, { compact: true })} enr`);
  if (d.enrollment_trend_3yr != null) {
    const sign = d.enrollment_trend_3yr >= 0 ? "+" : "";
    pills.push(`${d.enrollment_trend_3yr > 0 ? "Growth" : "Decline"} ${sign}${d.enrollment_trend_3yr.toFixed(1)}%`);
  }
  if (d.vendor_count > 0) pills.push(`${d.vendor_count} vendor${d.vendor_count !== 1 ? "s" : ""}`);

  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] p-4 hover:border-[#C2BBD4] transition-colors duration-100">
      {/* Top row: district name + action bar */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <TierBadge tier={d.tier} />
            <p className="text-sm font-semibold text-[#403770] truncate">{d.name}</p>
          </div>
          <p className="text-xs text-[#8A80A8] truncate mt-0.5">{subtitle}</p>
        </div>
        <ClaimButton
          leaid={d.leaid}
          districtName={d.name}
          isCustomer={d.is_customer}
          owner={d.owner}
        />
      </div>

      {/* Main row: donut + badges + pills */}
      <div className="flex items-center gap-4">
        <div className="shrink-0">
          <ScoreDonut fit={d.fit_score} value={d.value_score} readiness={d.readiness_score}
            state={d.state_score} composite={d.composite_score} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Status badges */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            {d.is_customer && (
              <span className="text-[10px] font-semibold text-[#3d7a28] bg-[#F7FFF2] px-2 py-0.5 rounded-full border border-[#8AC670]">
                Customer
              </span>
            )}
            {d.fy26_fm_ek12_rev > 0 && (
              <span className="text-[10px] font-semibold text-[#3d6f84] bg-[#e8f1f5] px-2 py-0.5 rounded-full border border-[#8bb5cb]">
                FY26 {fmtNum(d.fy26_fm_ek12_rev, { dollar: true })}
              </span>
            )}
            {!d.is_customer && d.fy26_fm_ek12_rev === 0 && d.lifetime_vendor_rev > 0 && (
              <span className="text-[10px] font-medium text-[#8A80A8] bg-[#F7F5FA] px-2 py-0.5 rounded-full border border-[#E2DEEC]">
                {fmtNum(d.lifetime_vendor_rev, { dollar: true })} lifetime
              </span>
            )}
          </div>

          {/* Fact pills */}
          <div className="flex flex-wrap gap-1.5">
            {pills.map((pill) => (
              <span key={pill}
                className="bg-[#F7F5FA] text-[#6E6390] text-[10px] px-2 py-0.5 rounded-full border border-[#E2DEEC]">
                {pill}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const PAGE_SIZE = 30;

export default function TopProspects({ data }: { data: District[] }) {
  const [tierFilter, setTierFilter] = useState("t1_t2");
  const [stateFilter, setStateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const availableStates = useMemo(
    () => Array.from(new Set(data.map((d) => d.state).filter(Boolean))).sort(),
    [data]
  );

  const filtered = useMemo(() => {
    let result = data;

    // Tier filter
    if (tierFilter === "t1_t2") {
      result = result.filter((d) => d.tier === "Tier 1" || d.tier === "Tier 2");
    } else if (tierFilter !== "all") {
      result = result.filter((d) => d.tier === tierFilter);
    }

    // State filter
    if (stateFilter !== "all") {
      result = result.filter((d) => d.state === stateFilter);
    }

    // Status filter
    if (statusFilter === "customer") {
      result = result.filter((d) => d.is_customer);
    } else if (statusFilter === "pipeline") {
      result = result.filter((d) => d.has_open_pipeline && !d.is_customer);
    } else if (statusFilter === "prospect") {
      result = result.filter((d) => !d.is_customer && !d.has_open_pipeline);
    }

    // Search
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(
        (d) => d.name.toLowerCase().includes(q) || d.state.toLowerCase().includes(q) || (d.city ?? "").toLowerCase().includes(q)
      );
    }

    return result.sort((a, b) => b.composite_score - a.composite_score);
  }, [data, tierFilter, stateFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasActiveFilters = tierFilter !== "t1_t2" || stateFilter !== "all" || statusFilter !== "all" || search.trim() !== "";

  const handleClearFilters = useCallback(() => {
    setTierFilter("t1_t2");
    setStateFilter("all");
    setStatusFilter("all");
    setSearch("");
    setPage(1);
  }, []);

  const selectCls =
    "flex-1 max-w-[150px] px-3 py-1.5 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none";

  return (
    <SectionCard
      title="Top Districts"
      description={`${filtered.length.toLocaleString()} districts matching filters`}
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="search"
          placeholder="Search districts..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="flex-1 max-w-[200px] px-3 py-1.5 text-sm text-[#6E6390] placeholder:text-[#A69DC0] border border-[#C2BBD4] rounded-lg bg-white focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
        />

        <select value={tierFilter} onChange={(e) => { setTierFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="t1_t2">Tier 1 & 2</option>
          <option value="all">All Tiers</option>
          <option value="Tier 1">Tier 1 Only</option>
          <option value="Tier 2">Tier 2 Only</option>
          <option value="Tier 3">Tier 3</option>
          <option value="Tier 4">Tier 4</option>
        </select>

        <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="all">All States</option>
          {availableStates.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="all">All Statuses</option>
          <option value="customer">Customer</option>
          <option value="pipeline">Pipeline</option>
          <option value="prospect">Prospect</option>
        </select>

        {hasActiveFilters && (
          <button onClick={handleClearFilters} className="text-xs font-medium text-[#403770] hover:underline whitespace-nowrap">
            Clear filters
          </button>
        )}
      </div>

      {/* Cards grid */}
      {paged.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {paged.map((d) => (
            <ProspectCard key={d.leaid} d={d} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-[#8A80A8]">
          <p className="text-sm font-medium">No districts match your filters</p>
          <button onClick={handleClearFilters} className="text-xs text-[#403770] underline mt-2">Clear filters</button>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#E2DEEC]">
          <span className="text-xs text-[#8A80A8]">
            {((safePage - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(safePage * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage(safePage - 1)}
              className="px-2 py-1 text-xs font-medium text-[#6E6390] border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <span className="text-xs text-[#6E6390] px-2">
              {safePage} / {totalPages}
            </span>
            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage(safePage + 1)}
              className="px-2 py-1 text-xs font-medium text-[#6E6390] border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
