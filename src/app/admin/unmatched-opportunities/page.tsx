"use client";

import { useState, useCallback, useMemo, useRef, useEffect, Suspense } from "react";
import { createPortal } from "react-dom";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unmatchedOpportunityColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";
import { useUsers } from "@/features/shared/lib/queries";
import { DistrictSearchModal, type DistrictResult } from "@/features/shared/components/DistrictSearch/DistrictSearchModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UnmatchedOpportunity {
  id: string;
  name: string | null;
  accountName: string | null;
  state: string | null;
  schoolYr: string | null;
  stage: string | null;
  netBookingAmount: string | null;
  reason: string | null;
  resolved: boolean;
  resolvedDistrictLeaid: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchOpportunities(params: {
  resolved?: string;
  school_yr?: string;
  state?: string;
  stage?: string;
  reason?: string;
  search?: string;
  has_district_id?: string;
  stage_group?: string;
  rep?: string;
  sort_by?: string;
  sort_dir?: string;
  page: number;
  page_size: number;
}): Promise<{ items: UnmatchedOpportunity[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.resolved) qs.set("resolved", params.resolved);
  if (params.school_yr) qs.set("school_yr", params.school_yr);
  if (params.state) qs.set("state", params.state);
  if (params.stage) qs.set("stage", params.stage);
  if (params.reason) qs.set("reason", params.reason);
  if (params.search) qs.set("search", params.search);
  if (params.has_district_id) qs.set("has_district_id", params.has_district_id);
  if (params.stage_group) qs.set("stage_group", params.stage_group);
  if (params.rep) qs.set("rep", params.rep);
  if (params.sort_by) qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/unmatched-opportunities?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function fetchFacets(): Promise<{ stages: string[]; reasons: string[] }> {
  const res = await fetch("/api/admin/unmatched-opportunities/facets");
  if (!res.ok) throw new Error("Failed to fetch facets");
  return res.json();
}

const UNRESOLVED_REASONS = [
  "Needs Review",
  "Missing District",
  "Name/LEAID mismatch",
  "NCES-only link: name mismatch",
  "NCES-only link: unknown NCES",
  "Remove Child Opp",
  "Organization",
  "University",
  "Private/Charter",
] as const;

async function updateReason(
  id: string,
  reason: string | null,
): Promise<{ id: string; reason: string | null }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to update reason (${res.status})`);
  }
  return res.json();
}

async function resolveOpportunity(
  id: string,
  resolvedDistrictLeaid: string,
): Promise<{ resolvedCount: number }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolvedDistrictLeaid }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to resolve (${res.status})`);
  }
  return res.json();
}

async function dismissOpportunity(
  id: string,
  dismissAll: boolean,
): Promise<{ dismissedCount: number; accountName: string | null }> {
  const res = await fetch(`/api/admin/unmatched-opportunities/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dismiss: true, dismissAll }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || `Failed to dismiss (${res.status})`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Currency formatter (no decimals per project preference)
// ---------------------------------------------------------------------------

function formatCurrency(value: string | number | null | undefined): string {
  if (value == null || value === "") return "\u2014";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "\u2014";
  return "$" + Math.round(num).toLocaleString();
}

function formatCompactCurrency(value: number): string {
  if (value >= 1_000_000) {
    const m = value / 1_000_000;
    return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M";
  }
  if (value >= 1_000) {
    const k = value / 1_000;
    return "$" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K";
  }
  return "$" + Math.round(value).toLocaleString();
}

// ---------------------------------------------------------------------------
// Summary data
// ---------------------------------------------------------------------------

interface SummaryData {
  totalCount: number;
  withDistrictId: number;
  withoutDistrictId: number;
  openBookings: number;
  closedWonBookings: number;
  closedLostBookings: number;
}

async function fetchSummary(): Promise<SummaryData> {
  const res = await fetch("/api/admin/unmatched-opportunities/summary");
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

// ---------------------------------------------------------------------------
// KPI Summary Cards
// ---------------------------------------------------------------------------

type CardKey = "unmatched" | "hasDistrictId" | "openPipeline" | "closedWon" | "closedLost";

function SummaryCards({
  data,
  activeCard,
  onCardClick,
}: {
  data: SummaryData | undefined;
  activeCard: CardKey | null;
  onCardClick: (key: CardKey) => void;
}) {
  const cards: { key: CardKey; label: string; value: string; subtitle: string; accent: string }[] = [
    {
      key: "unmatched",
      label: "Unmatched",
      value: data ? data.totalCount.toLocaleString() : "—",
      subtitle: "unresolved opportunities",
      accent: "#403770",
    },
    {
      key: "hasDistrictId",
      label: "Has District ID",
      value: data ? data.withDistrictId.toLocaleString() : "—",
      subtitle: data ? `${data.withoutDistrictId.toLocaleString()} without` : "",
      accent: "#6EA3BE",
    },
    {
      key: "openPipeline",
      label: "Open Pipeline",
      value: data ? formatCompactCurrency(data.openBookings) : "—",
      subtitle: "net booking amount",
      accent: "#FFCF70",
    },
    {
      key: "closedWon",
      label: "Closed Won",
      value: data ? formatCompactCurrency(data.closedWonBookings) : "—",
      subtitle: "net booking amount",
      accent: "#8AA891",
    },
    {
      key: "closedLost",
      label: "Closed Lost",
      value: data ? formatCompactCurrency(data.closedLostBookings) : "—",
      subtitle: "net booking amount",
      accent: "#F37167",
    },
  ];

  return (
    <div className="grid gap-3 grid-cols-5">
      {cards.map((card) => {
        const isActive = activeCard === card.key;
        return (
          <button
            key={card.key}
            onClick={() => onCardClick(card.key)}
            className={`text-left bg-white rounded-lg border shadow-sm p-4 relative overflow-hidden transition-all duration-100 ${
              isActive
                ? "border-[#403770] ring-2 ring-[#403770]/20"
                : "border-[#D4CFE2] hover:border-[#C2BBD4] hover:shadow"
            }`}
          >
            <div
              className="absolute left-0 top-0 bottom-0 w-[3px]"
              style={{ backgroundColor: card.accent }}
            />
            <p className="text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider mb-1">
              {card.label}
            </p>
            <p className={`text-xl font-bold tabular-nums ${data ? "text-[#403770]" : "text-[#A69DC0]"}`}>
              {card.value}
            </p>
            {card.subtitle && (
              <p className="text-[11px] text-[#A69DC0]">{card.subtitle}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Reason dropdown (inline cell editor)
// ---------------------------------------------------------------------------

function ReasonDropdown({
  value,
  opportunityId,
  onUpdate,
}: {
  value: string | null;
  opportunityId: string;
  onUpdate: (id: string, reason: string | null) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [pos, setPos] = useState({ top: -9999, left: -9999 });

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setIsOpen(true);
  };

  // Close on outside click, Escape, or scroll
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    const handleScroll = () => setIsOpen(false);
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen]);

  const handleSelect = (reason: string | null) => {
    onUpdate(opportunityId, reason);
    setIsOpen(false);
  };

  const options: { value: string | null; label: string }[] = [
    { value: null, label: "—" },
    ...UNRESOLVED_REASONS.map((r) => ({ value: r as string | null, label: r })),
  ];

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); isOpen ? setIsOpen(false) : openDropdown(); }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={`w-full text-xs text-left border border-transparent rounded-lg pl-1.5 pr-6 py-1 bg-transparent hover:border-[#C2BBD4] hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent focus:bg-white cursor-pointer transition-colors ${
          value ? "text-[#403770] font-medium" : "text-[#A69DC0]"
        }`}
      >
        {value ?? "—"}
      </button>
      <svg
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A69DC0] pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>

      {isOpen && createPortal(
        <ul
          ref={dropdownRef}
          role="listbox"
          className="fixed z-[9999] min-w-[160px] bg-white rounded-xl shadow-xl border border-[#D4CFE2] py-1"
          style={{ top: pos.top, left: pos.left }}
        >
          {options.map((opt) => {
            const isSelected = value === opt.value;
            return (
              <li
                key={opt.label}
                role="option"
                aria-selected={isSelected}
                onClick={(e) => { e.stopPropagation(); handleSelect(opt.value); }}
                className={`px-3 py-1.5 text-xs cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#F7F5FA] font-medium text-[#403770]"
                    : opt.value === null
                      ? "text-[#A69DC0] hover:bg-[#EFEDF5]"
                      : "text-[#403770] hover:bg-[#EFEDF5]"
                }`}
              >
                {opt.label}
              </li>
            );
          })}
        </ul>,
        document.body
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ resolved, resolvedDistrictLeaid }: { resolved: boolean; resolvedDistrictLeaid?: string | null }) {
  if (resolved && !resolvedDistrictLeaid) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F4F7] text-[#8A80A8] border border-[#A69DC0]/30">
        Dismissed
      </span>
    );
  }
  if (resolved) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FFF2] text-[#69B34A] border border-[#8AC670]/30">
        Resolved
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fef1f0] text-[#F37167] border border-[#f58d85]/30">
      Unresolved
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

function UnmatchedOpportunitiesContent() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  // Mount-only seed: reading ?rep= here is intentional. We do NOT sync
  // searchParams -> filters via useEffect because that would clobber chips
  // the user adds via the filter bar after arriving on the page.
  const initialRepId = searchParams?.get("rep") ?? null;

  const { data: users } = useUsers();

  // Summary stats for KPI cards
  const { data: summary } = useQuery({
    queryKey: ["unmatched-opportunities-summary"],
    queryFn: fetchSummary,
    staleTime: 30 * 1000,
  });

  // Fetch distinct stage/reason values for filter dropdowns
  const { data: facets } = useQuery({
    queryKey: ["unmatched-opportunities-facets"],
    queryFn: fetchFacets,
    staleTime: 5 * 60 * 1000,
  });

  // Hydrate column defs with facet values
  const hydratedColumns = useMemo(() => {
    return unmatchedOpportunityColumns.map((col) => {
      if (col.key === "stage" && facets) return { ...col, enumValues: facets.stages };
      if (col.key === "reason" && facets) return { ...col, enumValues: facets.reasons };
      if (col.key === "rep") {
        const repOptions = (users ?? [])
          .filter((u) => u.fullName)
          .map((u) => ({ value: u.id, label: u.fullName as string }));
        return { ...col, enumValues: repOptions };
      }
      return col;
    });
  }, [facets, users]);

  // DataGrid state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    unmatchedOpportunityColumns.filter((c) => c.isDefault).map((c) => c.key)
  );
  const [sorts, setSorts] = useState<SortRule[]>([
    { column: "netBookingAmount", direction: "desc" },
  ]);
  const [page, setPage] = useState(1);
  // Start with "unresolved" filter active (same default as current page)
  const [filters, setFilters] = useState<FilterRule[]>(() => {
    const base: FilterRule[] = [
      { column: "resolved", operator: "is_false", value: false },
    ];
    if (initialRepId) {
      base.push({ column: "rep", operator: "eq", value: initialRepId });
    }
    return base;
  });

  const [activeCard, setActiveCard] = useState<CardKey | null>(null);
  const [resolvingOpp, setResolvingOpp] = useState<UnmatchedOpportunity | null>(null);
  const [dismissingOpp, setDismissingOpp] = useState<UnmatchedOpportunity | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Sort handler (single-sort, 3-click cycle: asc -> desc -> clear)
  const handleSort = useCallback((column: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (!existing) return [{ column, direction: "asc" as const }];
      if (existing.direction === "asc") return [{ column, direction: "desc" as const }];
      return [];
    });
    setPage(1);
  }, []);

  // Card click handler — toggle card filter, reset page
  const handleCardClick = useCallback((key: CardKey) => {
    setActiveCard((prev) => (prev === key ? null : key));
    setPage(1);
  }, []);

  // Derive API params from FilterRule[] array
  const resolvedFilter = filters.find((f) => f.column === "resolved");
  const resolvedParam = resolvedFilter
    ? resolvedFilter.operator === "is_true" ? "true" : "false"
    : undefined;
  const schoolYrFilter = filters.find((f) => f.column === "schoolYr" && f.operator === "eq");
  const stateFilterRule = filters.find((f) => f.column === "state" && f.operator === "eq");
  const stageFilter = filters.find((f) => f.column === "stage" && f.operator === "eq");
  const reasonFilter = filters.find((f) => f.column === "reason" && f.operator === "eq");
  const searchFilter = filters.find((f) => f.column === "name" && f.operator === "contains");
  const repFilter = filters.find((f) => f.column === "rep" && f.operator === "eq");
  const repFilterId = repFilter ? String(repFilter.value) : undefined;

  // Derive card-based API params
  const cardParams: { has_district_id?: string; stage_group?: string } = {};
  if (activeCard === "hasDistrictId") cardParams.has_district_id = "true";
  if (activeCard === "openPipeline") cardParams.stage_group = "open";
  if (activeCard === "closedWon") cardParams.stage_group = "closed_won";
  if (activeCard === "closedLost") cardParams.stage_group = "closed_lost";

  const sortRule = sorts[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["unmatched-opportunities", filters, sorts, page, activeCard, repFilterId],
    queryFn: () =>
      fetchOpportunities({
        resolved: resolvedParam,
        school_yr: schoolYrFilter ? String(schoolYrFilter.value) : undefined,
        state: stateFilterRule ? String(stateFilterRule.value) : undefined,
        stage: stageFilter ? String(stageFilter.value) : undefined,
        reason: reasonFilter ? String(reasonFilter.value) : undefined,
        search: searchFilter ? String(searchFilter.value) : undefined,
        rep: repFilterId,
        ...cardParams,
        sort_by: sortRule?.column,
        sort_dir: sortRule?.direction,
        page,
        page_size: 50,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, leaid }: { id: string; leaid: string; districtName: string }) =>
      resolveOpportunity(id, leaid),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities-summary"] });
      const count = data.resolvedCount ?? 1;
      const countLabel = count > 1 ? `${count} opportunities` : "1 opportunity";
      setToast(`Resolved ${countLabel} to ${variables.districtName} (${variables.leaid})`);
      setResolvingOpp(null);
    },
    onError: (error) => {
      const msg = error.message?.includes("not found")
        ? "District not found in system — use Create New District to add it first"
        : "Failed to resolve opportunity";
      setToast(msg);
      setResolvingOpp(null);
    },
  });

  const reasonMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string | null }) =>
      updateReason(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities-facets"] });
    },
    onError: (error) => {
      setToast(error.message || "Failed to update reason");
    },
  });

  const dismissMutation = useMutation({
    mutationFn: ({ id, dismissAll }: { id: string; dismissAll: boolean }) =>
      dismissOpportunity(id, dismissAll),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities-summary"] });
      const count = data.dismissedCount ?? 1;
      const countLabel = count > 1 ? `${count} opportunities` : "1 opportunity";
      setToast(`Dismissed ${countLabel}${data.accountName ? ` for ${data.accountName}` : ""}`);
      setDismissingOpp(null);
    },
    onError: (error) => {
      setToast(error.message || "Failed to dismiss opportunity");
      setDismissingOpp(null);
    },
  });

  const handleReasonUpdate = useCallback(
    (id: string, reason: string | null) => {
      reasonMutation.mutate({ id, reason });
    },
    [reasonMutation]
  );

  const handleResolve = useCallback(
    (district: DistrictResult) => {
      if (!resolvingOpp) return;
      resolveMutation.mutate({
        id: resolvingOpp.id,
        leaid: district.leaid,
        districtName: district.name,
      });
    },
    [resolvingOpp, resolveMutation]
  );

  // Cell renderers
  const cellRenderers = useMemo<Record<string, CellRendererFn>>(() => ({
    name: ({ value, row }) => {
      const name = value as string | null;
      const id = row.id as string;
      if (!name) return <span className="text-[#A69DC0]">&mdash;</span>;
      return (
        <a
          href={`https://lms.fullmindlearning.com/opportunities/${id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#6EA3BE] hover:text-[#403770] hover:underline transition-colors"
          title="Open in LMS"
        >
          {name}
        </a>
      );
    },
    accountLmsId: ({ value }) => {
      const lmsId = value as string | null;
      if (!lmsId) return <span className="text-[#A69DC0]">&mdash;</span>;
      return (
        <a
          href={`https://lms.fullmindlearning.com/districts/${lmsId}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-[#6EA3BE] hover:text-[#403770] hover:underline transition-colors tabular-nums"
          title="Open in LMS"
        >
          {lmsId}
        </a>
      );
    },
    resolvedDistrictLeaid: ({ value }) => {
      const leaid = value as string | null;
      if (!leaid) return <span className="text-[#A69DC0]">&mdash;</span>;
      return <span className="tabular-nums font-medium text-[#6E6390]">{leaid}</span>;
    },
    resolved: ({ value, row }) => {
      const isResolved = value as boolean;
      const leaid = row.resolvedDistrictLeaid as string | null;
      return <StatusBadge resolved={isResolved} resolvedDistrictLeaid={leaid} />;
    },
    reason: ({ value, row }) => (
      <ReasonDropdown
        value={value as string | null}
        opportunityId={row.id as string}
        onUpdate={handleReasonUpdate}
      />
    ),
    netBookingAmount: ({ value }) => (
      <span className="tabular-nums font-medium">{formatCurrency(value as string)}</span>
    ),
  }), [handleReasonUpdate]);

  const renderRowAction = useCallback((row: Record<string, unknown>) => {
    const isResolved = row.resolved as boolean;
    if (isResolved) return null;

    const oppData: UnmatchedOpportunity = {
      id: row.id as string,
      name: row.name as string | null,
      accountName: row.accountName as string | null,
      state: row.state as string | null,
      schoolYr: row.schoolYr as string | null,
      stage: row.stage as string | null,
      netBookingAmount: row.netBookingAmount as string | null,
      reason: row.reason as string | null,
      resolved: row.resolved as boolean,
      resolvedDistrictLeaid: row.resolvedDistrictLeaid as string | null,
    };

    return (
      <div className="flex items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); setResolvingOpp(oppData); }}
          className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
        >
          Resolve
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setDismissingOpp(oppData); }}
          className="px-2 py-1 text-xs font-medium text-[#8A80A8] hover:text-[#F37167] hover:bg-[#fef1f0] rounded-lg transition-colors"
          title="Dismiss — stop syncing this opportunity"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      {/* Header + Summary */}
      <div className="mb-3 shrink-0">
        <div className="flex items-baseline justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Unmatched Opportunities</h1>
            <p className="text-sm text-[#8A80A8] mt-0.5">
              Opportunities that could not be automatically matched to a district.
              {data?.pagination && (
                <span className="ml-1 font-medium text-[#6E6390]">
                  {data.pagination.total} showing
                </span>
              )}
            </p>
          </div>
        </div>
        <SummaryCards data={summary} activeCard={activeCard} onCardClick={handleCardClick} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-2 flex-wrap shrink-0">
        <AdminFilterBar
          columnDefs={hydratedColumns}
          filters={filters}
          onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
          onRemoveFilter={(i) => {
            setFilters((prev) => {
              const removed = prev[i];
              if (removed?.column === "rep") {
                const url = new URL(window.location.href);
                url.searchParams.delete("rep");
                router.replace(url.pathname + url.search);
              }
              return prev.filter((_, idx) => idx !== i);
            });
            setPage(1);
          }}
          onUpdateFilter={(i, f) => { setFilters((prev) => prev.map((existing, idx) => idx === i ? f : existing)); setPage(1); }}
        />
        <div className="ml-auto">
          <AdminColumnPicker
            columnDefs={hydratedColumns}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 flex flex-col">
      <DataGrid
        data={(data?.items ?? []) as unknown as Record<string, unknown>[]}
        columnDefs={hydratedColumns}
        entityType="opportunities"
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        visibleColumns={visibleColumns}
        onColumnsChange={setVisibleColumns}
        sorts={sorts}
        onSort={handleSort}
        hasActiveFilters={filters.length > 0}
        onClearFilters={() => { setFilters([]); setPage(1); }}
        pagination={data?.pagination}
        onPageChange={setPage}
        cellRenderers={cellRenderers}
        renderRowAction={renderRowAction}
      />
      </div>

      {/* Resolution modal */}
      {resolvingOpp && (
        <DistrictSearchModal
          subjectName={resolvingOpp.accountName ?? ""}
          subjectState={resolvingOpp.state}
          onSelect={handleResolve}
          onClose={() => setResolvingOpp(null)}
        />
      )}

      {/* Dismiss confirmation dialog */}
      {dismissingOpp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDismissingOpp(null)}>
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-[#403770] mb-2">Dismiss opportunity?</h3>
            <p className="text-sm text-[#6E6390] mb-1">
              <span className="font-semibold">{dismissingOpp.accountName ?? "Unknown account"}</span>
            </p>
            <p className="text-sm text-[#8A80A8] mb-5">
              Dismissed opportunities will stop syncing into the planning tool.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDismissingOpp(null)}
                className="px-3 py-1.5 text-sm font-medium text-[#6E6390] hover:bg-[#F5F4F7] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => dismissMutation.mutate({ id: dismissingOpp.id, dismissAll: false })}
                disabled={dismissMutation.isPending}
                className="px-3 py-1.5 text-sm font-medium text-[#F37167] border border-[#f58d85]/40 hover:bg-[#fef1f0] rounded-lg transition-colors disabled:opacity-50"
              >
                {dismissMutation.isPending ? "Dismissing..." : "Dismiss this opp"}
              </button>
              {dismissingOpp.accountName && (
                <button
                  onClick={() => dismissMutation.mutate({ id: dismissingOpp.id, dismissAll: true })}
                  disabled={dismissMutation.isPending}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0615a] rounded-lg transition-colors disabled:opacity-50"
                >
                  {dismissMutation.isPending ? "Dismissing..." : "Dismiss all for account"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg border bg-[#F7FFF2] border-[#8AC670] shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <svg className="w-4 h-4 text-[#69B34A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span className="text-sm font-medium text-[#5f665b]">{toast}</span>
        </div>
      )}
    </div>
  );
}

export default function UnmatchedOpportunitiesPage() {
  return (
    <Suspense fallback={null}>
      <UnmatchedOpportunitiesContent />
    </Suspense>
  );
}
