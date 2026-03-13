"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { unmatchedOpportunityColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";

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

interface DistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  enrollment: number | null;
  cityLocation: string | null;
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

async function searchDistricts(q: string): Promise<{ items: DistrictResult[] }> {
  if (q.length < 2) return { items: [] };
  const res = await fetch(`/api/admin/districts/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to search districts");
  return res.json();
}

async function fetchSuggestions(name: string, state?: string | null): Promise<{ items: DistrictResult[] }> {
  const qs = new URLSearchParams({ name });
  if (state) qs.set("state", state);
  const res = await fetch(`/api/admin/districts/suggestions?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch suggestions");
  return res.json();
}

async function createDistrict(data: {
  leaid: string;
  name: string;
  stateAbbrev: string;
  cityLocation?: string;
}): Promise<DistrictResult> {
  const res = await fetch("/api/admin/districts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Failed to create district" }));
    throw new Error(err.error || "Failed to create district");
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
  if (!res.ok) throw new Error("Failed to resolve");
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

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ resolved }: { resolved: boolean }) {
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
// US States (for create form dropdown)
// ---------------------------------------------------------------------------

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL",
  "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME",
  "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI",
  "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

// ---------------------------------------------------------------------------
// District search modal
// ---------------------------------------------------------------------------

function DistrictRow({
  district,
  onSelect,
}: {
  district: DistrictResult;
  onSelect: (d: DistrictResult) => void;
}) {
  return (
    <button
      onClick={() => onSelect(district)}
      className="w-full text-left px-4 py-3 border-b border-[#E2DEEC] last:border-b-0 hover:bg-[#EFEDF5] transition-colors duration-100"
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium text-[#403770]">
            {district.name}
          </span>
          {district.cityLocation && (
            <span className="text-xs text-[#8A80A8] ml-2">
              {district.cityLocation}, {district.stateAbbrev}
            </span>
          )}
        </div>
        <span className="text-xs text-[#A69DC0] font-medium tabular-nums">
          {district.leaid}
        </span>
      </div>
      {district.enrollment != null && (
        <div className="text-xs text-[#8A80A8] mt-0.5">
          Enrollment: {district.enrollment.toLocaleString()}
        </div>
      )}
    </button>
  );
}

function CreateDistrictForm({
  opportunity,
  onCreated,
  onCancel,
}: {
  opportunity: UnmatchedOpportunity;
  onCreated: (district: DistrictResult) => void;
  onCancel: () => void;
}) {
  const [leaid, setLeaid] = useState("");
  const [name, setName] = useState(opportunity.accountName ?? "");
  const [stateAbbrev, setStateAbbrev] = useState(opportunity.state ?? "");
  const [cityLocation, setCityLocation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () => createDistrict({ leaid, name: name.trim(), stateAbbrev, cityLocation: cityLocation.trim() || undefined }),
    onSuccess: (district) => onCreated(district),
    onError: (err: Error) => setError(err.message),
  });

  const isValid = /^\d{7}$/.test(leaid) && name.trim().length > 0 && stateAbbrev.length === 2;

  return (
    <div className="space-y-3">
      {error && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg border bg-[#fef1f0] border-[#f58d85]">
          <svg className="w-4 h-4 text-[#c25a52] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
          </svg>
          <span className="text-xs font-medium text-[#c25a52]">{error}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-[#544A78] mb-1">
          NCES LEAID <span className="text-[#F37167]">*</span>
        </label>
        <input
          type="text"
          value={leaid}
          onChange={(e) => { setLeaid(e.target.value.replace(/\D/g, "").slice(0, 7)); setError(null); }}
          placeholder="7-digit ID (e.g. 0100005)"
          className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0] tabular-nums"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-[#544A78] mb-1">
          District Name <span className="text-[#F37167]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          placeholder="e.g. Springfield Public Schools"
          className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
        />
      </div>

      <div className="flex gap-3">
        <div className="w-28">
          <label className="block text-xs font-medium text-[#544A78] mb-1">
            State <span className="text-[#F37167]">*</span>
          </label>
          <select
            value={stateAbbrev}
            onChange={(e) => { setStateAbbrev(e.target.value); setError(null); }}
            className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none bg-white"
          >
            <option value="">—</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-[#544A78] mb-1">
            City
          </label>
          <input
            type="text"
            value={cityLocation}
            onChange={(e) => setCityLocation(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
        >
          Back
        </button>
        <button
          onClick={() => createMutation.mutate()}
          disabled={!isValid || createMutation.isPending}
          className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          {createMutation.isPending ? "Creating..." : "Create & Resolve"}
        </button>
      </div>
    </div>
  );
}

function DistrictSearchModal({
  opportunity,
  onSelect,
  onClose,
}: {
  opportunity: UnmatchedOpportunity;
  onSelect: (district: DistrictResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showCreate) inputRef.current?.focus();
  }, [showCreate]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  // Fuzzy suggestions based on opportunity name + state
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery({
    queryKey: ["district-suggestions", opportunity.accountName, opportunity.state],
    queryFn: () => fetchSuggestions(opportunity.accountName ?? "", opportunity.state),
    enabled: !!opportunity.accountName,
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ["district-search", debouncedQuery],
    queryFn: () => searchDistricts(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  const hasSuggestions = (suggestions?.items.length ?? 0) > 0;
  const isSearching = debouncedQuery.length >= 2;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-[#403770]">
              {showCreate ? "Create New District" : "Resolve to District"}
            </h3>
            <p className="text-sm text-[#8A80A8] mt-1">
              {opportunity.accountName}
              {opportunity.state && <span className="ml-1">({opportunity.state})</span>}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {showCreate ? (
          <CreateDistrictForm
            opportunity={opportunity}
            onCreated={onSelect}
            onCancel={() => setShowCreate(false)}
          />
        ) : (
          <>
            {/* Suggestions section */}
            {!isSearching && (
              <div className="mb-3">
                {suggestionsLoading && (
                  <div className="px-4 py-4 text-center border border-[#E2DEEC] rounded-lg">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#403770] border-t-transparent mx-auto mb-2" />
                    <span className="text-xs text-[#8A80A8]">Finding potential matches...</span>
                  </div>
                )}
                {!suggestionsLoading && hasSuggestions && (
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-semibold text-[#403770] uppercase tracking-wide">
                        Suggested Matches
                      </span>
                      <span className="text-[10px] text-[#8A80A8] bg-[#F5F3FA] px-1.5 py-0.5 rounded">
                        {suggestions!.items.length} found
                      </span>
                    </div>
                    <div className="border border-[#D6D0E8] rounded-lg max-h-48 overflow-y-auto bg-[#FDFCFF]">
                      {suggestions!.items.map((district) => (
                        <DistrictRow key={district.leaid} district={district} onSelect={onSelect} />
                      ))}
                    </div>
                  </div>
                )}
                {!suggestionsLoading && !hasSuggestions && opportunity.accountName && (
                  <div className="px-4 py-3 text-center text-xs text-[#8A80A8] border border-[#E2DEEC] rounded-lg">
                    No automatic matches found — try searching below.
                  </div>
                )}
              </div>
            )}

            {/* Divider + search label */}
            {!isSearching && hasSuggestions && (
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 h-px bg-[#E2DEEC]" />
                <span className="text-[10px] text-[#A69DC0] uppercase tracking-wide">or search manually</span>
                <div className="flex-1 h-px bg-[#E2DEEC]" />
              </div>
            )}

            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Escape" && onClose()}
                placeholder="Search districts by name, LEAID, or state..."
                className="w-full pl-10 pr-4 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
              />
            </div>

            {/* Search results */}
            {isSearching && (
              <div className="max-h-64 overflow-y-auto border border-[#E2DEEC] rounded-lg">
                {searchLoading && (
                  <div className="px-4 py-8 text-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#403770] border-t-transparent mx-auto" />
                  </div>
                )}
                {!searchLoading && searchResults?.items.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-[#8A80A8]">
                    No districts found
                  </div>
                )}
                {searchResults?.items.map((district) => (
                  <DistrictRow key={district.leaid} district={district} onSelect={onSelect} />
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mt-4">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-[#6EA3BE] hover:text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create new district
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UnmatchedOpportunitiesPage() {
  const queryClient = useQueryClient();

  // Fetch distinct stage/reason values for filter dropdowns
  const { data: facets } = useQuery({
    queryKey: ["unmatched-opportunities-facets"],
    queryFn: fetchFacets,
    staleTime: 5 * 60 * 1000,
  });

  // Hydrate column defs with facet values
  const hydratedColumns = useMemo(() => {
    if (!facets) return unmatchedOpportunityColumns;
    return unmatchedOpportunityColumns.map((col) => {
      if (col.key === "stage") return { ...col, enumValues: facets.stages };
      if (col.key === "reason") return { ...col, enumValues: facets.reasons };
      return col;
    });
  }, [facets]);

  // DataGrid state
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    unmatchedOpportunityColumns.filter((c) => c.isDefault).map((c) => c.key)
  );
  const [sorts, setSorts] = useState<SortRule[]>([
    { column: "netBookingAmount", direction: "desc" },
  ]);
  const [page, setPage] = useState(1);
  // Start with "unresolved" filter active (same default as current page)
  const [filters, setFilters] = useState<FilterRule[]>([
    { column: "resolved", operator: "is_false", value: false },
  ]);

  const [resolvingOpp, setResolvingOpp] = useState<UnmatchedOpportunity | null>(null);
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

  const sortRule = sorts[0];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["unmatched-opportunities", filters, sorts, page],
    queryFn: () =>
      fetchOpportunities({
        resolved: resolvedParam,
        school_yr: schoolYrFilter ? String(schoolYrFilter.value) : undefined,
        state: stateFilterRule ? String(stateFilterRule.value) : undefined,
        stage: stageFilter ? String(stageFilter.value) : undefined,
        reason: reasonFilter ? String(reasonFilter.value) : undefined,
        search: searchFilter ? String(searchFilter.value) : undefined,
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
      const count = data.resolvedCount ?? 1;
      const countLabel = count > 1 ? `${count} opportunities` : "1 opportunity";
      setToast(`Resolved ${countLabel} to ${variables.districtName} (${variables.leaid})`);
      setResolvingOpp(null);
    },
  });

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
    resolved: ({ value }) => {
      const isResolved = value as boolean;
      return <StatusBadge resolved={isResolved} />;
    },
    netBookingAmount: ({ value }) => (
      <span className="tabular-nums font-medium">{formatCurrency(value as string)}</span>
    ),
  }), []);

  const renderRowAction = useCallback((row: Record<string, unknown>) => {
    const isResolved = row.resolved as boolean;
    if (isResolved) return null;
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setResolvingOpp({
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
          });
        }}
        className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
      >
        Resolve
      </button>
    );
  }, []);

  return (
    <div className="flex flex-col h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="mb-6 shrink-0">
        <h1 className="text-xl font-bold text-[#403770]">Unmatched Opportunities</h1>
        <p className="text-sm text-[#8A80A8] mt-1">
          Opportunities that could not be automatically matched to a district.
          {data?.pagination && (
            <span className="ml-1 font-medium text-[#6E6390]">
              {data.pagination.total} total
            </span>
          )}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap shrink-0">
        <AdminFilterBar
          columnDefs={hydratedColumns}
          filters={filters}
          onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
          onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
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
      <div className="flex-1 min-h-0 overflow-auto">
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
          opportunity={resolvingOpp}
          onSelect={handleResolve}
          onClose={() => setResolvingOpp(null)}
        />
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
