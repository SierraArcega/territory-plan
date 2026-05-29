"use client";

/**
 * PortfolioView — the /views entry page.
 *
 * Renders three tabs (My plans / Team plans / Archived plans) and a
 * responsive card grid of `PlanCardPortfolio` tiles.
 *
 * Bucket rules:
 *   - mine     — status !== "archived" AND current user is owner or collaborator.
 *   - team     — status !== "archived" AND the user is not on the plan.
 *   - archived — status === "archived" regardless of ownership.
 *
 * The Team tab has a filter bar (owner / state / status / district-contains)
 * that resets whenever the user leaves the team tab.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { usePlansWithStats, type PlanWithStats } from "../lib/queries";
import { useViewsRouter, type PortfolioBucket } from "../hooks/useViewsRouter";
import { useProfile } from "@/features/shared/lib/queries";
import {
  MultiSelect,
  type MultiSelectOption,
} from "@/features/shared/components/MultiSelect";
import { AnchoredPopover } from "./grid/AnchoredPopover";
import PlanCardPortfolio, { NewPlanCard } from "./PlanCardPortfolio";

/** Compact dollar formatter ("$1.2M", "$622K", "$48"). */
function formatDollars(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/** Compact integer formatter (1234 → "1,234"). */
function formatInt(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString();
}

/** Is the current user on this plan (owner or collaborator)? */
function isOnPlan(plan: PlanWithStats, userId: string | null): boolean {
  if (!userId) return false;
  if (plan.owner?.id === userId) return true;
  return plan.collaborators.some((c) => c.id === userId);
}

const STATUS_OPTIONS: MultiSelectOption[] = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
];

// ── District type-ahead filter ────────────────────────────────────────────────

interface DistrictHit {
  leaid: string;
  name: string;
  stateAbbrev: string;
}

function DistrictSearchFilter({
  value,
  onChange,
}: {
  value: { leaid: string; name: string } | null;
  onChange: (d: { leaid: string; name: string } | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DistrictHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    const controller = new AbortController();
    const id = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/districts/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        const data = (await res.json()) as { items?: DistrictHit[] };
        setResults(data.items ?? []);
        setOpen(true);
      } catch (e) {
        if ((e as { name?: string }).name !== "AbortError") setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      window.clearTimeout(id);
      controller.abort();
    };
  }, [query]);

  // If a district is selected, show a dismissible chip.
  if (value) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-[#D4CFE2] bg-[#F7F5FA] px-2.5 py-1 text-[12px] text-[#403770] whitespace-nowrap">
        <span>Contains: {value.name}</span>
        <button
          type="button"
          aria-label="Clear district filter"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
          className="ml-0.5 text-[#8A80A8] hover:text-[#403770] transition-colors"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#A69DC0]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Contains district…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-48 rounded-md border border-[#D4CFE2] bg-white py-1.5 pl-7 pr-3 text-[12px] text-[#403770] placeholder-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#D4CFE2]"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[#8A80A8]">
            …
          </span>
        )}
      </div>
      <AnchoredPopover
        anchorRef={inputRef}
        open={open}
        onDismiss={() => setOpen(false)}
      >
        <div className="w-72 overflow-hidden rounded-lg border border-[#E2DEEC] bg-white shadow-[0_8px_24px_rgba(64,55,112,0.12)]">
          {results.length === 0 ? (
            <div className="px-3 py-3 text-[12px] text-[#8A80A8]">No matches</div>
          ) : (
            results.map((d) => (
              <button
                key={d.leaid}
                type="button"
                onClick={() => {
                  onChange({ leaid: d.leaid, name: d.name });
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[12px] text-[#403770] hover:bg-[#F7F5FA] border-b border-[#EFEDF5] last:border-0"
              >
                <span className="truncate">{d.name}</span>
                <span className="ml-2 shrink-0 text-[11px] text-[#8A80A8]">
                  {d.stateAbbrev}
                </span>
              </button>
            ))
          )}
        </div>
      </AnchoredPopover>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PortfolioView() {
  const router = useViewsRouter();
  const { bucket } = router;

  const plansQ = usePlansWithStats(false, false);
  const profileQ = useProfile();
  const userId = profileQ.data?.id ?? null;

  const allPlans: PlanWithStats[] = plansQ.data ?? [];

  // Three-way split. "mine" wins over "team" when both conditions could match.
  const { mine, team, archived } = useMemo(() => {
    const mineArr: PlanWithStats[] = [];
    const teamArr: PlanWithStats[] = [];
    const archivedArr: PlanWithStats[] = [];
    for (const p of allPlans) {
      if (p.status === "archived") {
        archivedArr.push(p);
      } else if (isOnPlan(p, userId)) {
        mineArr.push(p);
      } else {
        teamArr.push(p);
      }
    }
    return { mine: mineArr, team: teamArr, archived: archivedArr };
  }, [allPlans, userId]);

  // ── Team Plans filter state ────────────────────────────────────────────────
  const [ownerFilter, setOwnerFilter] = useState<string[]>([]);
  const [stateFilter, setStateFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [districtFilter, setDistrictFilter] = useState<{
    leaid: string;
    name: string;
  } | null>(null);

  // Reset all filters when leaving the team tab (render-phase pattern).
  const [prevBucket, setPrevBucket] = useState<PortfolioBucket>(bucket);
  if (prevBucket !== bucket) {
    setPrevBucket(bucket);
    if (bucket !== "team") {
      setOwnerFilter([]);
      setStateFilter([]);
      setStatusFilter([]);
      setDistrictFilter(null);
    }
  }

  // Filter options derived from the team array.
  const ownerOptions = useMemo<MultiSelectOption[]>(() => {
    const byId = new Map<string, string>();
    for (const p of team) {
      if (p.owner) byId.set(p.owner.id, p.owner.fullName ?? "Unknown");
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ value: id, label: id === userId ? "Me" : name }))
      .sort((a, b) => {
        if (a.value === userId) return -1;
        if (b.value === userId) return 1;
        return a.label.localeCompare(b.label);
      });
  }, [team, userId]);

  const stateOptions = useMemo<MultiSelectOption[]>(() => {
    const seen = new Map<string, string>();
    for (const p of team) {
      for (const s of p.states ?? []) {
        if (!seen.has(s.abbrev)) seen.set(s.abbrev, s.name ?? s.abbrev);
      }
    }
    return [...seen.entries()]
      .map(([abbrev, name]) => ({ value: abbrev, label: `${abbrev} — ${name}` }))
      .sort((a, b) => a.value.localeCompare(b.value));
  }, [team]);

  // Apply all four filters (ANDed).
  const teamFiltered = useMemo(() => {
    return team.filter((p) => {
      if (
        ownerFilter.length > 0 &&
        !(p.owner && ownerFilter.includes(p.owner.id))
      )
        return false;
      if (
        stateFilter.length > 0 &&
        !p.states?.some((s) => stateFilter.includes(s.abbrev))
      )
        return false;
      if (statusFilter.length > 0 && !statusFilter.includes(p.status))
        return false;
      if (districtFilter && !p.districtLeaids.includes(districtFilter.leaid))
        return false;
      return true;
    });
  }, [team, ownerFilter, stateFilter, statusFilter, districtFilter]);

  const isFilteredEmpty =
    bucket === "team" &&
    team.length > 0 &&
    teamFiltered.length === 0 &&
    (ownerFilter.length > 0 ||
      stateFilter.length > 0 ||
      statusFilter.length > 0 ||
      districtFilter !== null);

  const shown =
    bucket === "archived" ? archived : bucket === "team" ? teamFiltered : mine;

  // Header stats are computed from the active book (mine + team).
  const totals = useMemo(() => {
    const activeCount = mine.length + team.length;
    const pipeline =
      mine.reduce((acc, p) => acc + (p.pipelineValue ?? 0), 0) +
      team.reduce((acc, p) => acc + (p.pipelineValue ?? 0), 0);
    const contacts =
      mine.reduce((acc, p) => acc + (p.contactsCount ?? 0), 0) +
      team.reduce((acc, p) => acc + (p.contactsCount ?? 0), 0);
    const opps =
      mine.reduce((acc, p) => acc + (p.oppsCount ?? 0), 0) +
      team.reduce((acc, p) => acc + (p.oppsCount ?? 0), 0);
    return { pipeline, contacts, opps, plansCount: activeCount };
  }, [mine, team]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-[#D4CFE2] bg-white flex-shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8] whitespace-nowrap">
            {bucket === "archived" ? "Archived" : "Portfolio"}
          </p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#403770] whitespace-nowrap">
            All plans
          </h1>
        </div>
        <div className="flex items-baseline gap-4 flex-wrap">
          <PortfolioStat label="Open pipeline" value={formatDollars(totals.pipeline)} />
          <PortfolioStat label="Total contacts" value={formatInt(totals.contacts)} />
          <PortfolioStat label="Open opps" value={formatInt(totals.opps)} />
          <PortfolioStat label="Plans" value={formatInt(totals.plansCount)} tone="up" />
        </div>
      </header>

      {/* Body */}
      <section className="flex-1 min-h-0 overflow-y-auto bg-[#FFFCFA] px-6 py-5">
        {/* Tab strip */}
        <div
          className="flex gap-0 mb-0 border-b border-[#E2DEEC]"
          role="tablist"
          aria-label="Plan ownership"
        >
          <PortfolioTab
            active={bucket === "mine"}
            label={`My plans · ${mine.length}`}
            onClick={() => router.goToPortfolio("mine")}
          />
          <PortfolioTab
            active={bucket === "team"}
            label={`Team plans · ${team.length}`}
            onClick={() => router.goToPortfolio("team")}
          />
          <PortfolioTab
            active={bucket === "archived"}
            label={`Archived plans · ${archived.length}`}
            onClick={() => router.goToPortfolio("archived")}
          />
        </div>

        {/* Team Plans filter bar — only visible on team tab */}
        {bucket === "team" && (
          <div className="flex flex-wrap items-center gap-2 py-3 mb-3 border-b border-[#EFEDF5]">
            {ownerOptions.length > 0 && (
              <MultiSelect
                id="portfolio-owner-filter"
                label="Owner"
                options={ownerOptions}
                selected={ownerFilter}
                onChange={setOwnerFilter}
                placeholder="Owner"
                countLabel="owners"
                searchPlaceholder="Search people…"
              />
            )}
            {stateOptions.length > 0 && (
              <MultiSelect
                id="portfolio-state-filter"
                label="State"
                options={stateOptions}
                selected={stateFilter}
                onChange={setStateFilter}
                placeholder="State"
                countLabel="states"
                searchPlaceholder="Search states…"
              />
            )}
            <MultiSelect
              id="portfolio-status-filter"
              label="Status"
              options={STATUS_OPTIONS}
              selected={statusFilter}
              onChange={setStatusFilter}
              placeholder="Status"
              countLabel="statuses"
            />
            <DistrictSearchFilter
              value={districtFilter}
              onChange={setDistrictFilter}
            />
          </div>
        )}

        {/* Card grid */}
        <div className={bucket === "team" ? "" : "mt-[18px]"}>
          {plansQ.isLoading ? (
            <Skeletons />
          ) : plansQ.isError ? (
            <ErrorBlock />
          ) : bucket !== "mine" && shown.length === 0 ? (
            isFilteredEmpty ? (
              <FilteredEmptyBlock />
            ) : (
              <EmptyBlock bucket={bucket} />
            )
          ) : (
            <div
              className="grid gap-[14px]"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
            >
              {shown.map((p) => (
                <PlanCardPortfolio
                  key={p.id}
                  plan={p}
                  archived={bucket === "archived"}
                />
              ))}
              {bucket === "mine" && <NewPlanCard />}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface PortfolioStatProps {
  label: string;
  value: string;
  tone?: "up";
}
function PortfolioStat({ label, value, tone }: PortfolioStatProps) {
  return (
    <div className="text-right min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] whitespace-nowrap">
        {label}
      </p>
      <p
        className="mt-0.5 text-[18px] font-bold tabular-nums whitespace-nowrap"
        style={{ color: tone === "up" ? "#5f665b" : "#403770" }}
      >
        {value}
      </p>
    </div>
  );
}

interface PortfolioTabProps {
  active: boolean;
  label: string;
  onClick: () => void;
}
function PortfolioTab({ active, label, onClick }: PortfolioTabProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`px-3.5 py-2 bg-transparent text-[13px] -mb-[1px] border-b-2 transition-colors duration-100 whitespace-nowrap ${
        active
          ? "border-[#403770] text-[#403770] font-semibold"
          : "border-transparent text-[#8A80A8] font-medium hover:text-[#544A78]"
      }`}
    >
      {label}
    </button>
  );
}

function Skeletons() {
  return (
    <div
      className="grid gap-[14px]"
      style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}
      aria-busy="true"
    >
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="relative flex flex-col gap-3 rounded-lg border border-[#D4CFE2] bg-white p-4 min-h-[200px]"
          aria-hidden
        >
          <span className="absolute left-0 right-0 top-0 h-[3px] rounded-t-lg bg-[#EFEDF5]" />
          <div className="h-3 w-16 rounded bg-[#F7F5FA] animate-pulse" />
          <div className="h-4 w-2/3 rounded bg-[#F7F5FA] animate-pulse" />
          <div className="mt-auto h-1 w-full rounded-full bg-[#EFEDF5]" />
        </div>
      ))}
    </div>
  );
}

function FilteredEmptyBlock() {
  return (
    <div className="rounded-lg border border-dashed border-[#D4CFE2] bg-white p-8 text-center">
      <p className="text-sm font-semibold text-[#403770] whitespace-nowrap">
        No plans match your filters
      </p>
      <p className="mt-1 text-xs text-[#8A80A8]">
        Try adjusting or clearing the filters above.
      </p>
    </div>
  );
}

function ErrorBlock() {
  return (
    <div className="rounded-lg border border-[#D4CFE2] bg-white p-6 text-center">
      <p className="text-sm font-medium text-[#403770] whitespace-nowrap">
        Couldn&apos;t load plans
      </p>
      <p className="mt-1 text-xs text-[#8A80A8]">Try refreshing the page.</p>
    </div>
  );
}

interface EmptyBlockProps {
  bucket: PortfolioBucket;
}
function EmptyBlock({ bucket }: EmptyBlockProps) {
  const { title, body } =
    bucket === "archived"
      ? { title: "No archived plans", body: "Plans you archive will appear here." }
      : bucket === "team"
        ? {
            title: "No team plans",
            body: "Plans owned by your teammates will appear here.",
          }
        : {
            title: "You don't own any plans yet",
            body: "Create one with the New plan card on this tab to get started.",
          };
  return (
    <div className="rounded-lg border border-dashed border-[#D4CFE2] bg-white p-8 text-center">
      <p className="text-sm font-semibold text-[#403770] whitespace-nowrap">{title}</p>
      <p className="mt-1 text-xs text-[#8A80A8]">{body}</p>
    </div>
  );
}
