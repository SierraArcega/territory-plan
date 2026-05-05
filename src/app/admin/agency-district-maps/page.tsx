"use client";

import { useState, useMemo, useCallback, Suspense } from "react";
import { useQuery } from "@tanstack/react-query";
import { agencyDistrictMapColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";

interface AgencyMapping {
  kind: "district" | "state" | "non_lea";
  leaid: string | null;
  stateFips: string | null;
  districtName: string | null;
  notes: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
}

interface AgencyRow {
  agencyKey: number;
  agencyName: string;
  agencyPath: string | null;
  stateAbbrev: string | null;
  unresolvedRfpCount: number;
  totalRfpCount: number;
  latestCaptured: string | null;
  soonestOpenDue: string | null;
  totalValueLow: string | null;
  totalValueHigh: string | null;
  mapping: AgencyMapping | null;
}

interface PaginationInfo { page: number; pageSize: number; total: number; }

async function fetchAgencies(params: {
  status?: string;
  state?: string;
  q?: string;
  sort_by?: string;
  sort_dir?: string;
  page: number;
  page_size: number;
}): Promise<{ items: AgencyRow[]; pagination: PaginationInfo }> {
  const qs = new URLSearchParams();
  if (params.status)   qs.set("status",  params.status);
  if (params.state)    qs.set("state",   params.state);
  if (params.q)        qs.set("q",       params.q);
  if (params.sort_by)  qs.set("sort_by", params.sort_by);
  if (params.sort_dir) qs.set("sort_dir", params.sort_dir);
  qs.set("page", String(params.page));
  qs.set("page_size", String(params.page_size));
  const res = await fetch(`/api/admin/agency-district-maps?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch");
  return res.json();
}

function formatCompactCurrencyRange(low: string | null, high: string | null): string {
  const l = parseFloat(low ?? "0");
  const h = parseFloat(high ?? "0");
  if (l === 0 && h === 0) return "—";
  const fmt = (n: number) => {
    if (n >= 1_000_000) { const m = n / 1_000_000; return "$" + (m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)) + "M"; }
    if (n >= 1_000)     { const k = n / 1_000;     return "$" + (k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)) + "K"; }
    return "$" + Math.round(n).toLocaleString();
  };
  return l === h ? fmt(l) : `${fmt(l)} – ${fmt(h)}`;
}

function relTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const days = Math.round((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

function MappingBadge({ mapping }: { mapping: AgencyMapping | null }) {
  if (!mapping) {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#fef1f0] text-[#F37167] border border-[#f58d85]/30">Untriaged</span>;
  }
  if (mapping.kind === "district") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7FFF2] text-[#69B34A] border border-[#8AC670]/30">{`→ ${mapping.districtName ?? mapping.leaid}`}</span>;
  }
  if (mapping.kind === "state") {
    return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F7F5FA] text-[#403770] border border-[#C2BBD4]">{`→ State-only`}</span>;
  }
  return <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#F5F4F7] text-[#8A80A8] border border-[#A69DC0]/30">Non-LEA</span>;
}

function AgencyDistrictMapsContent() {
  const [filters, setFilters] = useState<FilterRule[]>([
    { column: "status", operator: "eq", value: "untriaged" },
  ]);
  const [sorts, setSorts] = useState<SortRule[]>([{ column: "unresolvedRfpCount", direction: "desc" }]);
  const [page, setPage] = useState(1);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(
    agencyDistrictMapColumns.filter((c) => c.isDefault && !c.isFilterOnly).map((c) => c.key)
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const statusFilter = filters.find((f) => f.column === "status" && f.operator === "eq");
  const stateFilter  = filters.find((f) => f.column === "stateAbbrev" && f.operator === "eq");
  const qFilter      = filters.find((f) => f.column === "agencyName" && f.operator === "contains");
  const sort = sorts[0];
  const sortByMap: Record<string, string> = {
    unresolvedRfpCount: "unresolved_rfp_count",
    totalRfpCount: "total_rfp_count",
    totalValue: "total_value_low",
    latestCaptured: "latest_captured",
    soonestOpenDue: "soonest_open_due",
    agencyName: "agency_name",
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["agency-district-maps", filters, sorts, page],
    queryFn: () => fetchAgencies({
      status:   statusFilter ? String(statusFilter.value) : "untriaged",
      state:    stateFilter  ? String(stateFilter.value)  : undefined,
      q:        qFilter      ? String(qFilter.value)      : undefined,
      sort_by:  sort ? sortByMap[sort.column]             : undefined,
      sort_dir: sort?.direction,
      page,
      page_size: 50,
    }),
  });

  const handleSort = useCallback((column: string) => {
    setSorts((prev) => {
      const existing = prev.find((s) => s.column === column);
      if (!existing) return [{ column, direction: "asc" as const }];
      if (existing.direction === "asc") return [{ column, direction: "desc" as const }];
      return [];
    });
    setPage(1);
  }, []);

  const cellRenderers = useMemo<Record<string, CellRendererFn>>(() => ({
    agencyName: ({ value, row }) => (
      <div>
        <div className="font-medium text-[#403770]">{String(value ?? "—")}</div>
        {row.agencyPath ? (
          <a href={String(row.agencyPath)} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#A69DC0] hover:text-[#403770]" onClick={(e) => e.stopPropagation()}>HigherGov ↗</a>
        ) : null}
      </div>
    ),
    totalValue: ({ row }) => (
      <span className="tabular-nums">
        {formatCompactCurrencyRange(row.totalValueLow as string | null, row.totalValueHigh as string | null)}
      </span>
    ),
    totalRfpCount: ({ value }) => <span className="tabular-nums">{Number(value ?? 0).toLocaleString()}</span>,
    unresolvedRfpCount: ({ value }) => <span className="tabular-nums font-medium">{Number(value ?? 0).toLocaleString()}</span>,
    latestCaptured: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
    soonestOpenDue: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
    mappingStatus: ({ row }) => <MappingBadge mapping={row.mapping as AgencyMapping | null} />,
    resolvedAt: ({ value }) => <span className="text-[#8A80A8]">{relTime(value as string | null)}</span>,
  }), []);

  const rowsForGrid = (data?.items ?? []).map((r) => ({ ...r, id: String(r.agencyKey) }));

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="mb-3 shrink-0">
        <h1 className="text-xl font-bold text-[#403770]">RFP Agency Mappings</h1>
        <p className="text-sm text-[#8A80A8] mt-0.5">
          Manually map HigherGov agencies to districts when the automatic name match can&apos;t.
          {data?.pagination ? <span className="ml-1 font-medium text-[#6E6390]">{data.pagination.total} agencies showing</span> : null}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-2 flex-wrap shrink-0">
        <AdminFilterBar
          columnDefs={agencyDistrictMapColumns}
          filters={filters}
          onAddFilter={(f) => { setFilters((prev) => [...prev, f]); setPage(1); }}
          onRemoveFilter={(i) => { setFilters((prev) => prev.filter((_, idx) => idx !== i)); setPage(1); }}
          onUpdateFilter={(i, f) => { setFilters((prev) => prev.map((x, idx) => idx === i ? f : x)); setPage(1); }}
        />
        <div className="ml-auto">
          <AdminColumnPicker
            columnDefs={agencyDistrictMapColumns}
            visibleColumns={visibleColumns}
            onColumnsChange={setVisibleColumns}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <DataGrid
          data={rowsForGrid as unknown as Record<string, unknown>[]}
          columnDefs={agencyDistrictMapColumns}
          entityType="agency-district-maps"
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
          rowIdAccessor="id"
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              if (next.has(id)) next.delete(id); else next.add(id);
              return next;
            });
          }}
          onSelectPage={(ids) => {
            setSelectedIds((prev) => {
              const next = new Set(prev);
              const allSelected = ids.every((i) => next.has(i));
              if (allSelected) ids.forEach((i) => next.delete(i));
              else ids.forEach((i) => next.add(i));
              return next;
            });
          }}
          onClearSelection={() => setSelectedIds(new Set())}
        />
      </div>
    </div>
  );
}

export default function AgencyDistrictMapsPage() {
  return (
    <Suspense fallback={null}>
      <AgencyDistrictMapsContent />
    </Suspense>
  );
}
