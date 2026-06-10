"use client";

// Leads workspace — composition + all UI state per the design handoff:
// header + 5-tile stat strip, toolbar (search / FilterBuilder / Clear all /
// SortDropdown / scope + view + board-layout segmented controls), and the
// pipeline board (3 layouts) or table. Filtering/sorting is applied
// client-side over the scope-fetched leads (see lib/queries.ts for the
// rationale); board and table share one sorts[] source of truth.
//
// Integration points for the follow-up tracks:
//   • `selected` (lead id) + `onSelectLead` — L5 mounts LeadDetailPanel in the
//     marked slot below; the id is deep-linked via #lead=<id>.
//   • `modal` ("add" | "bulk" | null) — header buttons already set it; L8/L9
//     render AddLeadModal / BulkUploadModal in the marked slot.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Columns3,
  Filter,
  List,
  Plus,
  Rows3,
  Search,
  SlidersHorizontal,
  Table2,
  Target,
  Trello,
  Upload,
} from "lucide-react";
import SegmentedControl from "@/features/shared/components/SegmentedControl";
import FilterBuilder from "@/features/shared/components/filters/FilterBuilder";
import SortDropdown from "@/features/shared/components/filters/SortDropdown";
import {
  buildFilterPredicate,
  buildComparator,
  type ActiveFilter,
  type ColumnSort,
} from "@/features/shared/components/filters/filter-builder-utils";
import { useToast } from "@/features/shared/components/Toast";
import { useProfile } from "@/features/shared/lib/queries";
import { buildLeadFilterColumns } from "@/features/leads/lib/filter-columns";
import {
  useLeadsQuery,
  useUpdateLeadMutation,
  type LeadScope,
} from "@/features/leads/lib/queries";
import { slaState } from "@/features/leads/lib/sla";
import { STATUS_CONFIG } from "@/features/leads/lib/status-config";
import type { Lead, LeadStatus } from "@/features/leads/lib/types";
import LeadsBoard, { type BoardLayout } from "./board/LeadsBoard";
import LeadsTable from "./LeadsTable";
import StatTile from "./bits/StatTile";

type ViewMode = "board" | "table";
type LeadModal = "add" | "bulk" | null;

const LEAD_HASH_RE = /lead=([\w-]+)/;

/** Read the deep-linked lead id from the URL hash (#lead=<id>). */
function readLeadHash(): string | null {
  if (typeof window === "undefined") return null;
  const m = (window.location.hash || "").match(LEAD_HASH_RE);
  return m ? m[1] : null;
}

export default function LeadsView() {
  // ---- UI state --------------------------------------------------------------
  const [view, setView] = useState<ViewMode>("board");
  const [boardLayout, setBoardLayout] = useState<BoardLayout>("columns");
  const [search, setSearch] = useState("");
  // "mine" resolves to the current user server-side (the API's owner-scoping
  // default), so the scope control defaults to the current user without
  // waiting on the profile query.
  const [scope, setScope] = useState<LeadScope>("mine");
  const [filters, setFilters] = useState<ActiveFilter[]>([]);
  const [sorts, setSorts] = useState<ColumnSort[]>([]);
  // Selected lead id — restored from the #lead=<id> deep link on first render.
  const [selected, setSelected] = useState<string | null>(() => readLeadHash());
  // Modal stub state — L8 (Add MQL) / L9 (Bulk upload) render against this.
  const [modal, setModal] = useState<LeadModal>(null);

  const { data: profile } = useProfile();
  const { data, isLoading, isError, refetch } = useLeadsQuery(scope);
  const updateLead = useUpdateLeadMutation();
  const { showToast } = useToast();

  const leads = useMemo(() => data?.leads ?? [], [data]);

  // Keep the open lead reflected in the URL hash so a panel can be shared.
  useEffect(() => {
    try {
      history.replaceState(
        null,
        "",
        selected
          ? `#lead=${selected}`
          : window.location.pathname + window.location.search,
      );
    } catch {
      // history API unavailable (very old browsers) — deep link is best-effort
    }
  }, [selected]);

  // ---- Derived data ------------------------------------------------------------
  const columns = useMemo(() => buildLeadFilterColumns(leads), [leads]);

  const filtered = useMemo(() => {
    let arr = leads;
    const q = search.trim().toLowerCase();
    if (q) {
      arr = arr.filter((l) =>
        [
          l.contact?.name,
          l.contact?.title,
          l.district?.name,
          l.district?.city,
          l.district?.stateAbbrev,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    if (filters.length) arr = arr.filter(buildFilterPredicate(filters, columns));
    if (sorts.length) arr = [...arr].sort(buildComparator(sorts, columns));
    return arr;
  }, [leads, search, filters, sorts, columns]);

  // Stat strip counts follow the active scope (pre-filter).
  const stats = useMemo(() => {
    const by = (s: LeadStatus) => leads.filter((l) => l.status === s).length;
    return {
      newCount: by("new"),
      overdue: leads.filter(
        (l) => l.status === "new" && (slaState(l.assignedAt)?.overdue ?? false),
      ).length,
      working: by("working"),
      meetings: by("meeting_scheduled"),
      qualified: by("sales_qualified"),
    };
  }, [leads]);

  const selectedLead = selected ? (leads.find((l) => l.id === selected) ?? null) : null;

  // ---- Actions ------------------------------------------------------------------
  const onSelectLead = (lead: Lead) => setSelected(lead.id);

  // Drag-to-restage: optimistic PATCH { status }; the mutation rolls back and
  // toasts on error (422 illegal transition, 400 missing disqualify reason).
  const moveLead = (leadId: string, status: LeadStatus) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    updateLead.mutate(
      { id: leadId, status },
      {
        onSuccess: () => {
          showToast(
            `${lead.contact?.name ?? "Lead"} → ${STATUS_CONFIG[status].label}`,
            { tone: "success" },
          );
        },
      },
    );
  };

  const hasRefinements = filters.length > 0 || sorts.length > 0;
  const fetchedAll = data ? data.total <= leads.length : true;
  const workspaceEmpty =
    !isLoading && !isError && leads.length === 0 && !search.trim() && filters.length === 0;

  // ---- Render ----------------------------------------------------------------------
  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#FFFCFA]">
      {/* Header */}
      <div className="shrink-0 px-4 pt-5 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4 gap-y-3">
          <div className="min-w-0">
            <h1 className="whitespace-nowrap text-2xl font-bold tracking-[-0.02em] text-[#403770]">
              Leads
            </h1>
            <p className="mt-[3px] text-[13px] text-[#8A80A8]">
              Accept new leads within 2 business days, work the sequence, and log outcomes.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setModal("bulk")}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium text-[#403770] transition-colors duration-[120ms] hover:bg-[#EFEDF5]"
            >
              <Upload size={15} aria-hidden />
              Bulk upload
            </button>
            <button
              type="button"
              onClick={() => setModal("add")}
              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-[120ms] hover:bg-[#e25f55]"
            >
              <Plus size={15} aria-hidden />
              Add lead
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="mb-4 mt-[18px] grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[58px] animate-pulse rounded-[10px] border border-[#E2DEEC] bg-[#EFEDF5]"
              />
            ))
          ) : (
            <>
              <StatTile
                label="New · awaiting acceptance"
                value={stats.newCount}
                tone="warn"
                icon={Clock}
              />
              <StatTile
                label="SLA overdue"
                value={stats.overdue}
                tone={stats.overdue > 0 ? "alert" : "default"}
                icon={AlertTriangle}
              />
              <StatTile label="Working" value={stats.working} icon={Target} />
              <StatTile label="Meetings set" value={stats.meetings} icon={Calendar} />
              <StatTile
                label="Sales Qualified"
                value={stats.qualified}
                tone="good"
                icon={CheckCircle2}
              />
            </>
          )}
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 gap-y-2.5 border-b border-[#EFEDF5] pb-3.5">
          <div className="relative w-full sm:w-60">
            <Search
              size={15}
              className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[#A69DC0]"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads…"
              aria-label="Search leads"
              className="w-full rounded-lg border border-[#C2BBD4] bg-white py-2 pl-8 pr-3 text-[13px] text-[#403770] outline-none placeholder:text-[#A69DC0] focus:border-[#403770]"
            />
          </div>

          {isLoading ? (
            // Disabled placeholders — same dims as the live controls, so the
            // toolbar doesn't shift when options finish loading.
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full border border-dashed border-[#D4CFE2] bg-white px-[11px] py-1.5 text-xs font-semibold text-[#A69DC0]"
            >
              <Filter size={12} aria-hidden />
              Filter
            </button>
          ) : (
            <FilterBuilder columns={columns} filters={filters} onChange={setFilters} />
          )}

          <div className="ml-auto flex flex-wrap items-center gap-2.5">
            {hasRefinements && (
              <button
                type="button"
                onClick={() => {
                  setFilters([]);
                  setSorts([]);
                }}
                className="whitespace-nowrap px-0.5 py-1 text-xs font-semibold text-[#9E97B8] hover:text-[#C25A52]"
              >
                Clear all
              </button>
            )}
            {isLoading ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-[11px] py-[7px] text-[12.5px] font-semibold text-[#A69DC0]"
              >
                <SlidersHorizontal size={14} aria-hidden />
                Sort
              </button>
            ) : (
              <SortDropdown columns={columns} sorts={sorts} onChange={setSorts} />
            )}
            <SegmentedControl<LeadScope>
              ariaLabel="Lead scope"
              value={scope}
              onChange={setScope}
              options={[
                { value: "mine", label: "My leads" },
                { value: "team", label: "Team" },
              ]}
            />
            <SegmentedControl<ViewMode>
              ariaLabel="View"
              value={view}
              onChange={setView}
              options={[
                { value: "board", label: "Board", icon: <Trello size={14} /> },
                { value: "table", label: "Table", icon: <Table2 size={14} /> },
              ]}
            />
            {view === "board" && (
              <SegmentedControl<BoardLayout>
                ariaLabel="Board layout"
                value={boardLayout}
                onChange={setBoardLayout}
                options={[
                  { value: "columns", label: "Columns", icon: <Columns3 size={14} /> },
                  { value: "swimlanes", label: "Swimlanes", icon: <Rows3 size={14} /> },
                  { value: "grouped", label: "Grouped", icon: <List size={14} /> },
                ]}
              />
            )}
          </div>
        </div>

        {/* Filtered-count line */}
        {!isLoading && filtered.length !== leads.length && (
          <div className="mt-2.5 text-xs text-[#8A80A8]">
            Showing <strong className="font-bold text-[#403770]">{filtered.length}</strong>{" "}
            of {leads.length} {scope === "mine" ? "of your leads" : "team leads"}
          </div>
        )}
        {!isLoading && !fetchedAll && (
          <div className="mt-2.5 text-xs text-[#9A7B3F]">
            Showing the first {leads.length} of {data!.total} leads — narrow with search
            or filters to see the rest.
          </div>
        )}
      </div>

      {/* Body */}
      <div
        className={`min-h-0 flex-1 px-4 sm:px-7 ${
          view === "table" ? "overflow-auto pb-7 pt-[18px]" : "overflow-hidden pb-[22px] pt-4"
        }`}
      >
        {isLoading ? (
          <div className="flex h-full gap-3.5 overflow-hidden pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="hidden h-full min-w-[248px] flex-1 basis-0 flex-col gap-2 first:flex sm:flex">
                <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#EFEDF5]" />
                <div className="flex-1 animate-pulse rounded-[10px] border border-[#EDEAF4] bg-[#FAF8FC]" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="mx-auto mt-10 max-w-sm rounded-xl border border-[#F7C9C5] bg-[#FEF1F0] p-5 text-center">
            <div className="text-[13px] font-semibold text-[#C25A52]">
              Couldn&apos;t load leads.
            </div>
            <button
              type="button"
              onClick={() => refetch()}
              className="mt-3 whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-2 text-xs font-semibold text-[#403770] hover:bg-[#F7F5FA]"
            >
              Retry
            </button>
          </div>
        ) : workspaceEmpty ? (
          <div className="mx-auto mt-12 max-w-md text-center">
            <div className="text-[15px] font-semibold text-[#403770]">No leads yet</div>
            <p className="mt-1.5 text-[13px] text-[#8A80A8]">
              Add your first lead or bulk-import a list to start working the pipeline.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setModal("bulk")}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#F7F5FA]"
              >
                <Upload size={15} aria-hidden />
                Bulk upload
              </button>
              <button
                type="button"
                onClick={() => setModal("add")}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white hover:bg-[#e25f55]"
              >
                <Plus size={15} aria-hidden />
                Add lead
              </button>
            </div>
          </div>
        ) : view === "table" ? (
          <LeadsTable
            leads={filtered}
            selectedId={selected}
            onSelectLead={onSelectLead}
            sorts={sorts}
            onSortsChange={setSorts}
            currentUserId={profile?.id ?? null}
          />
        ) : (
          <LeadsBoard
            leads={filtered}
            layout={boardLayout}
            selectedId={selected}
            onSelectLead={onSelectLead}
            onMove={moveLead}
            currentUserId={profile?.id ?? null}
          />
        )}
      </div>

      {/* L5 integration slot: LeadDetailPanel mounts here against
          `selectedLead` / `setSelected(null)` (close). */}
      {selectedLead && null}

      {/* L8/L9 integration slot: AddLeadModal ("add") and BulkUploadModal
          ("bulk") render here against `modal` / `setModal(null)` (close). */}
      {modal && null}
    </div>
  );
}
