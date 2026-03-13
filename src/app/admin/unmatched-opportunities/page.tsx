"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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
  page: number;
  page_size: number;
}): Promise<{ items: UnmatchedOpportunity[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.resolved) qs.set("resolved", params.resolved);
  if (params.school_yr) qs.set("school_yr", params.school_yr);
  if (params.state) qs.set("state", params.state);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/unmatched-opportunities?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

async function searchDistricts(q: string): Promise<{ items: DistrictResult[] }> {
  if (q.length < 2) return { items: [] };
  const res = await fetch(`/api/admin/districts/search?q=${encodeURIComponent(q)}`);
  if (!res.ok) throw new Error("Failed to search districts");
  return res.json();
}

async function resolveOpportunity(id: string, resolvedDistrictLeaid: string) {
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
// District search modal
// ---------------------------------------------------------------------------

function DistrictSearchModal({
  onSelect,
  onClose,
}: {
  onSelect: (district: DistrictResult) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["district-search", debouncedQuery],
    queryFn: () => searchDistricts(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-1">Resolve to District</h3>
        <p className="text-sm text-[#8A80A8] mb-4">
          Search by district name, LEAID, or state abbreviation.
        </p>

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
            placeholder="Search districts..."
            className="w-full pl-10 pr-4 py-2 text-sm text-[#6E6390] border border-[#C2BBD4] rounded-lg focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none placeholder:text-[#A69DC0]"
          />
        </div>

        <div className="max-h-64 overflow-y-auto border border-[#E2DEEC] rounded-lg">
          {isLoading && debouncedQuery.length >= 2 && (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#403770] border-t-transparent mx-auto" />
            </div>
          )}
          {!isLoading && debouncedQuery.length >= 2 && data?.items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[#8A80A8]">
              No districts found
            </div>
          )}
          {!isLoading && debouncedQuery.length < 2 && (
            <div className="px-4 py-6 text-center text-xs text-[#A69DC0]">
              Type at least 2 characters to search
            </div>
          )}
          {data?.items.map((district) => (
            <button
              key={district.leaid}
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
          ))}
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter chip
// ---------------------------------------------------------------------------

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "bg-[#403770] text-white border border-transparent"
          : "bg-white text-[#8A80A8] border border-[#D4CFE2] hover:border-[#C2BBD4]"
      }`}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function UnmatchedOpportunitiesPage() {
  const queryClient = useQueryClient();

  const [resolvedFilter, setResolvedFilter] = useState<string>("false");
  const [schoolYrFilter, setSchoolYrFilter] = useState<string>("");
  const [stateFilter, setStateFilter] = useState<string>("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["unmatched-opportunities", resolvedFilter, schoolYrFilter, stateFilter, page],
    queryFn: () =>
      fetchOpportunities({
        resolved: resolvedFilter || undefined,
        school_yr: schoolYrFilter || undefined,
        state: stateFilter || undefined,
        page,
        page_size: pageSize,
      }),
  });

  const resolveMutation = useMutation({
    mutationFn: ({ id, leaid }: { id: string; leaid: string }) =>
      resolveOpportunity(id, leaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unmatched-opportunities"] });
      setResolvingId(null);
    },
  });

  const handleResolve = useCallback(
    (district: DistrictResult) => {
      if (!resolvingId) return;
      resolveMutation.mutate({ id: resolvingId, leaid: district.leaid });
    },
    [resolvingId, resolveMutation]
  );

  const items = data?.items ?? [];
  const pagination = data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.total / pagination.pageSize) : 1;

  const cycleResolvedFilter = (value: string) => {
    setResolvedFilter((prev) => (prev === value ? "" : value));
    setPage(1);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#403770]">Unmatched Opportunities</h1>
        <p className="text-sm text-[#8A80A8] mt-1">
          Opportunities that could not be automatically matched to a district.
          {pagination && (
            <span className="ml-1 font-medium text-[#6E6390]">
              {pagination.total} total
            </span>
          )}
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <FilterChip
          label="Unresolved"
          active={resolvedFilter === "false"}
          onClick={() => cycleResolvedFilter("false")}
        />
        <FilterChip
          label="Resolved"
          active={resolvedFilter === "true"}
          onClick={() => cycleResolvedFilter("true")}
        />

        <div className="h-4 w-px bg-[#E2DEEC]" />

        <select
          value={schoolYrFilter}
          onChange={(e) => { setSchoolYrFilter(e.target.value); setPage(1); }}
          className="border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390] bg-white focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none"
        >
          <option value="">All School Years</option>
          <option value="2024-25">2024-25</option>
          <option value="2025-26">2025-26</option>
          <option value="2026-27">2026-27</option>
        </select>

        <input
          type="text"
          placeholder="State (e.g. CA)"
          maxLength={2}
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value.toUpperCase()); setPage(1); }}
          className="w-24 border border-[#D4CFE2] rounded-lg px-3 py-1.5 text-xs font-medium text-[#6E6390] bg-white placeholder:text-[#A69DC0] focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/30 outline-none"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden border border-[#D4CFE2] rounded-lg bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-[#D4CFE2] bg-[#F7F5FA]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider">Account</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider w-16">State</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider w-24">School Year</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider w-28">Stage</th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider w-32">Net Booking</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider">Reason</th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#8A80A8] uppercase tracking-wider w-24">Status</th>
                <th className="w-20 px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={i < 4 ? "border-b border-[#E2DEEC]" : ""}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="bg-[#E2DEEC]/60 animate-pulse rounded h-4" style={{ width: `${[60, 50, 30, 40, 35, 40, 55, 30, 20][j]}%` }} />
                      </td>
                    ))}
                  </tr>
                ))}

              {isError && !isLoading && (
                <tr>
                  <td colSpan={9}>
                    <div className="py-10 flex flex-col items-center">
                      <p className="text-sm font-semibold text-[#544A78] mt-3">Failed to load opportunities</p>
                      <button onClick={() => refetch()} className="text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] px-3 py-1.5 rounded-lg border border-[#D4CFE2] mt-4 transition-colors">
                        Retry
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="text-center py-12">
                      <h3 className="text-lg font-medium text-[#6E6390] mb-2">No unmatched opportunities</h3>
                      <p className="text-sm text-[#8A80A8] max-w-sm mx-auto">
                        {resolvedFilter === "false"
                          ? "All opportunities have been resolved. Nice work!"
                          : "No opportunities match the current filters."}
                      </p>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && !isError && items.map((item, idx) => (
                <tr
                  key={item.id}
                  className={`group transition-colors duration-100 hover:bg-[#EFEDF5] ${idx < items.length - 1 ? "border-b border-[#E2DEEC]" : ""}`}
                >
                  <td className="px-4 py-3 text-sm font-medium text-[#403770] overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]" title={item.name ?? undefined}>
                    {item.name || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6E6390] overflow-hidden text-ellipsis whitespace-nowrap max-w-[180px]" title={item.accountName ?? undefined}>
                    {item.accountName || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6E6390]">{item.state || "\u2014"}</td>
                  <td className="px-4 py-3 text-sm text-[#6E6390]">{item.schoolYr || "\u2014"}</td>
                  <td className="px-4 py-3 text-sm text-[#6E6390] overflow-hidden text-ellipsis whitespace-nowrap" title={item.stage ?? undefined}>
                    {item.stage || "\u2014"}
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6E6390] text-right tabular-nums font-medium">
                    {formatCurrency(item.netBookingAmount)}
                  </td>
                  <td className="px-4 py-3 text-xs text-[#8A80A8] overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]" title={item.reason ?? undefined}>
                    {item.reason || "\u2014"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge resolved={item.resolved} />
                  </td>
                  <td className="px-3 py-3">
                    {!item.resolved && (
                      <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <button
                          onClick={() => setResolvingId(item.id)}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
                        >
                          Resolve
                        </button>
                      </div>
                    )}
                    {item.resolved && item.resolvedDistrictLeaid && (
                      <span className="text-[10px] text-[#8A80A8] font-medium tabular-nums">
                        {item.resolvedDistrictLeaid}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!isLoading && !isError && items.length > 0 && pagination && (
          <div className="px-4 py-2.5 border-t border-[#E2DEEC] bg-[#F7F5FA] flex items-center justify-between">
            <span className="text-xs font-medium text-[#A69DC0] tracking-wide">
              {pagination.total} opportunit{pagination.total !== 1 ? "ies" : "y"}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="px-2 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-[#8A80A8] tabular-nums">{page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="px-2 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resolution modal */}
      {resolvingId && (
        <DistrictSearchModal
          onSelect={handleResolve}
          onClose={() => setResolvingId(null)}
        />
      )}
    </div>
  );
}
