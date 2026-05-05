"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { agencyDistrictMapColumns } from "./columns";
import { DataGrid } from "@/features/shared/components/DataGrid/DataGrid";
import type { SortRule, FilterRule, CellRendererFn } from "@/features/shared/components/DataGrid/types";
import AdminFilterBar from "./AdminFilterBar";
import AdminColumnPicker from "./AdminColumnPicker";
import { DistrictSearchModal, type DistrictResult } from "@/features/shared/components/DistrictSearch/DistrictSearchModal";
import { US_STATES, abbrevToFips } from "@/lib/states";

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

type ResolutionStep = "pick" | "district" | "state" | "non_lea";

function KindPickerModal({
  agency,
  onPick,
  onRemove,
  onClose,
}: {
  agency: AgencyRow;
  onPick: (kind: "district" | "state" | "non_lea") => void;
  onRemove?: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-lg font-semibold text-[#403770]">Resolve {agency.agencyName}</h3>
        <p className="text-sm text-[#8A80A8] mt-1 mb-4">
          {agency.totalRfpCount} RFP{agency.totalRfpCount === 1 ? "" : "s"} from this agency
          {agency.stateAbbrev ? ` (${agency.stateAbbrev})` : ""}
        </p>

        <div className="space-y-2">
          <button
            onClick={() => onPick("district")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">Map to a district</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Search for the LEA this agency belongs to</div>
          </button>
          <button
            onClick={() => onPick("state")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">State-level only</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Real state agency / charter network — no specific LEA</div>
          </button>
          <button
            onClick={() => onPick("non_lea")}
            className="w-full text-left px-4 py-3 rounded-lg border border-[#D4CFE2] hover:border-[#403770] hover:bg-[#F7F5FA]"
          >
            <div className="font-medium text-[#403770]">Dismiss as non-LEA</div>
            <div className="text-xs text-[#8A80A8] mt-0.5">Vendor / federal entity / mis-classified — suppress from triage</div>
          </button>
        </div>

        {onRemove ? (
          <button
            onClick={onRemove}
            className="mt-3 w-full text-left px-4 py-3 rounded-lg border border-dashed border-[#C2BBD4] hover:border-[#F37167] hover:bg-[#fef1f0] text-[#F37167]"
          >
            <div className="font-medium">Remove mapping</div>
            <div className="text-xs text-[#A69DC0] mt-0.5">Revert to untriaged — next sync will re-run name match</div>
          </button>
        ) : null}

        <button onClick={onClose} className="mt-4 px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">
          Cancel
        </button>
      </div>
    </div>
  );
}

function StateOnlyModal({
  agency,
  onConfirm,
  onClose,
}: {
  agency: AgencyRow;
  onConfirm: (stateFips: string, notes: string) => void;
  onClose: () => void;
}) {
  const [stateAbbrev, setStateAbbrev] = useState(agency.stateAbbrev ?? "");
  const [notes, setNotes] = useState("");
  const fips = abbrevToFips(stateAbbrev);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-[#403770]">State-only mapping</h3>
          <p className="text-sm text-[#8A80A8] mt-1">{agency.agencyName}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#544A78] mb-1">State</label>
          <select
            value={stateAbbrev}
            onChange={(e) => setStateAbbrev(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg"
          >
            <option value="">—</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-[#544A78] mb-1">Notes (optional)</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg" placeholder="Why state-only?" />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
          <button
            onClick={() => fips && onConfirm(fips, notes)}
            disabled={!fips}
            className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 rounded-lg"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

function DismissConfirmDialog({
  agency,
  onConfirm,
  onClose,
}: {
  agency: AgencyRow;
  onConfirm: (notes: string) => void;
  onClose: () => void;
}) {
  const [notes, setNotes] = useState("");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-[#403770]">Dismiss as non-LEA?</h3>
        <p className="text-sm text-[#6E6390]">
          <span className="font-semibold">{agency.agencyName}</span> ({agency.totalRfpCount} RFP{agency.totalRfpCount === 1 ? "" : "s"}) will be hidden from the untriaged view.
        </p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg" placeholder="Notes (optional)" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-[#544A78] hover:bg-[#EFEDF5] rounded-lg">Cancel</button>
          <button onClick={() => onConfirm(notes)} className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#e0615a] rounded-lg">
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
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

  const queryClient = useQueryClient();
  const [resolvingAgency, setResolvingAgency] = useState<AgencyRow | null>(null);
  const [resolutionStep, setResolutionStep] = useState<ResolutionStep>("pick");
  const [toast, setToast] = useState<string | null>(null);

  const mapMutation = useMutation({
    mutationFn: async (input: {
      agencyKeys: number[];
      kind: "district" | "state" | "non_lea";
      leaid?: string;
      stateFips?: string;
      notes?: string;
    }) => {
      const res = await fetch("/api/admin/agency-district-maps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to map agencies");
      }
      return res.json() as Promise<{ mappedAgencyCount: number; cascadedRfpCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agency-district-maps"] });
      setSelectedIds(new Set());
      setResolvingAgency(null);
      setResolutionStep("pick");
      setToast(`Mapped ${data.mappedAgencyCount} agenc${data.mappedAgencyCount === 1 ? "y" : "ies"} — updated ${data.cascadedRfpCount} RFPs.`);
    },
    onError: (err: Error) => setToast(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (agencyKey: number) => {
      const res = await fetch(`/api/admin/agency-district-maps/${agencyKey}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to remove mapping");
      }
      return res.json() as Promise<{ removedRfpLeaidCount: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["agency-district-maps"] });
      setSelectedIds(new Set());
      setResolvingAgency(null);
      setResolutionStep("pick");
      setToast(`Mapping removed. ${data.removedRfpLeaidCount} RFPs reverted to untriaged.`);
    },
    onError: (err: Error) => setToast(err.message),
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

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
          renderRowAction={(row) => {
            const r = row as unknown as AgencyRow & { id: string };
            const isMapped = r.mapping !== null;
            return (
              <button
                onClick={(e) => { e.stopPropagation(); setResolvingAgency(r); setResolutionStep("pick"); }}
                className="px-2.5 py-1 text-xs font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg"
              >
                {isMapped ? "Edit mapping" : "Resolve"}
              </button>
            );
          }}
        />
      </div>

      {resolvingAgency && resolutionStep === "pick" && (
        <KindPickerModal
          agency={resolvingAgency}
          onPick={(k) => setResolutionStep(k)}
          onRemove={resolvingAgency.mapping ? () => deleteMutation.mutate(resolvingAgency.agencyKey) : undefined}
          onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
        />
      )}

      {resolvingAgency && resolutionStep === "district" && (
        <DistrictSearchModal
          subjectName={resolvingAgency.agencyName}
          subjectState={resolvingAgency.stateAbbrev}
          onSelect={(district: DistrictResult) => {
            mapMutation.mutate({
              agencyKeys: [resolvingAgency.agencyKey],
              kind: "district",
              leaid: district.leaid,
            });
          }}
          onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
        />
      )}

      {resolvingAgency && resolutionStep === "state" && (
        <StateOnlyModal
          agency={resolvingAgency}
          onConfirm={(stateFips, notes) => {
            mapMutation.mutate({
              agencyKeys: [resolvingAgency.agencyKey],
              kind: "state",
              stateFips,
              notes: notes || undefined,
            });
          }}
          onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
        />
      )}

      {resolvingAgency && resolutionStep === "non_lea" && (
        <DismissConfirmDialog
          agency={resolvingAgency}
          onConfirm={(notes) => {
            mapMutation.mutate({
              agencyKeys: [resolvingAgency.agencyKey],
              kind: "non_lea",
              notes: notes || undefined,
            });
          }}
          onClose={() => { setResolvingAgency(null); setResolutionStep("pick"); }}
        />
      )}

      {toast && (
        <div role="status" className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg border bg-[#F7FFF2] border-[#8AC670] shadow-lg">
          <span className="text-sm font-medium text-[#5f665b]">{toast}</span>
        </div>
      )}
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
