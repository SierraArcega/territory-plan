"use client";

/**
 * PortfolioView — the /views entry page.
 *
 * Replaces the Phase B stub. Renders an Active / Archived tab strip and a
 * responsive card grid of `PlanCardPortfolio` tiles. The Active tab also
 * shows a dashed "New plan" affordance at the end of the grid.
 *
 * Header stats note (Phase F deviation): the README's "Total target / Booked
 * / To target" portfolio aggregates are not exposed by the existing
 * `/api/territory-plans` endpoint and we agreed not to extend the API in this
 * pass. The four real aggregates we surface instead are computed client-side
 * from the fields the API already returns:
 *   - Open pipeline  — `sum(pipelineValue)`
 *   - Total contacts — `sum(contactsCount)`
 *   - Open opps      — `sum(oppsCount)`
 *   - Plans          — count of active plans
 *
 * Reading the active/archived tab from the URL keeps the tab state
 * bookmarkable / shareable. The footer affordance in `HiddenFooter` deep-links
 * to `?archived=1` so the user can find archived plans from the sidebar.
 */
import { useMemo } from "react";
import { usePlansWithStats, type PlanWithStats } from "../lib/queries";
import { useViewsRouter } from "../hooks/useViewsRouter";
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

export default function PortfolioView() {
  const router = useViewsRouter();
  const { showArchived } = router;

  const plansQ = usePlansWithStats();
  const allPlans: PlanWithStats[] = plansQ.data ?? [];

  // Plans are "archived" when their `status` is the literal "archived". All
  // other statuses (planning / working / stale) are bucketed into Active.
  const active = useMemo(
    () => allPlans.filter((p) => p.status !== "archived"),
    [allPlans],
  );
  const archived = useMemo(
    () => allPlans.filter((p) => p.status === "archived"),
    [allPlans],
  );
  const shown = showArchived ? archived : active;

  // Header stats are computed from the Active set so opening Archived
  // doesn't make the eyebrow stats appear to "drop" — the portfolio number
  // is your present-day book.
  const totals = useMemo(
    () => ({
      pipeline: active.reduce((acc, p) => acc + (p.pipelineValue ?? 0), 0),
      contacts: active.reduce((acc, p) => acc + (p.contactsCount ?? 0), 0),
      opps: active.reduce((acc, p) => acc + (p.oppsCount ?? 0), 0),
      plansCount: active.length,
    }),
    [active],
  );

  return (
    <>
      {/* Header — white bg, plum-tinted bottom border */}
      <header
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-[#D4CFE2] bg-white flex-shrink-0"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8] whitespace-nowrap">
            {showArchived ? "Archived" : "FY26 Portfolio"}
          </p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#403770] whitespace-nowrap">
            {showArchived ? `Archived plans · ${archived.length}` : "All plans"}
          </h1>
        </div>

        {/* Real portfolio stats — see file header for the substitution rationale. */}
        <div className="flex items-baseline gap-4 flex-wrap">
          <PortfolioStat
            label="Open pipeline"
            value={formatDollars(totals.pipeline)}
          />
          <PortfolioStat
            label="Total contacts"
            value={formatInt(totals.contacts)}
          />
          <PortfolioStat label="Open opps" value={formatInt(totals.opps)} />
          <PortfolioStat
            label="Plans"
            value={formatInt(totals.plansCount)}
            tone="up"
          />
        </div>
      </header>

      {/* Body — off-white background, scrollable */}
      <section className="flex-1 min-h-0 overflow-y-auto bg-[#FFFCFA] px-6 py-5">
        {/* Tab strip: Active / Archived */}
        <div
          className="flex gap-0 mb-[18px] border-b border-[#E2DEEC]"
          role="tablist"
          aria-label="Plan archive state"
        >
          <PortfolioTab
            active={!showArchived}
            label={`Active · ${active.length}`}
            onClick={() => router.goToPortfolio(false)}
          />
          <PortfolioTab
            active={showArchived}
            label={`Archived · ${archived.length}`}
            onClick={() => router.goToPortfolio(true)}
          />
        </div>

        {/* Card grid — auto-fill at 320px minimum so wide viewports get 4+
            columns while a 320px sidebar still surfaces 1-2 cards cleanly. */}
        {plansQ.isLoading ? (
          <Skeletons />
        ) : plansQ.isError ? (
          <ErrorBlock />
        ) : shown.length === 0 ? (
          <EmptyBlock archived={showArchived} />
        ) : (
          <div
            className="grid gap-[14px]"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {shown.map((p) => (
              <PlanCardPortfolio key={p.id} plan={p} archived={showArchived} />
            ))}
            {!showArchived && <NewPlanCard />}
          </div>
        )}
      </section>
    </>
  );
}

interface PortfolioStatProps {
  label: string;
  value: string;
  /** When set, render the value in the success-green sentiment color. */
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

/** Loading skeletons — three placeholder cards while plans resolve. */
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
  archived: boolean;
}
function EmptyBlock({ archived }: EmptyBlockProps) {
  return (
    <div className="rounded-lg border border-dashed border-[#D4CFE2] bg-white p-8 text-center">
      <p className="text-sm font-semibold text-[#403770] whitespace-nowrap">
        {archived ? "No archived plans" : "No plans yet"}
      </p>
      <p className="mt-1 text-xs text-[#8A80A8]">
        {archived
          ? "Plans you archive will appear here."
          : "Create a plan to get started — use the dashed card below."}
      </p>
    </div>
  );
}
