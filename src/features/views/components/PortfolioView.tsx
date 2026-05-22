"use client";

/**
 * PortfolioView — the /views entry page.
 *
 * Renders three tabs (My plans / Team plans / Archived plans) and a
 * responsive card grid of `PlanCardPortfolio` tiles. The My + Team tabs also
 * show a dashed "New plan" affordance at the end of the grid; new plans
 * default-own to the current user so they land in My plans.
 *
 * Bucket rules:
 *   - mine     — `status !== "archived"` AND current user is owner or in
 *                `collaborators`. This is the default landing tab.
 *   - team     — `status !== "archived"` AND the user is not on the plan.
 *   - archived — `status === "archived"` regardless of ownership.
 *
 * Header stats are computed from the active book (mine + team) so opening
 * Archived doesn't make the eyebrow stats appear to "drop". The four
 * client-side aggregates substitute for the README's Total target / Booked /
 * To target set, which would require new API fields.
 */
import { useMemo } from "react";
import { usePlansWithStats, type PlanWithStats } from "../lib/queries";
import { useViewsRouter, type PortfolioBucket } from "../hooks/useViewsRouter";
import { useProfile } from "@/features/shared/lib/queries";
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

export default function PortfolioView() {
  const router = useViewsRouter();
  const { bucket } = router;

  const plansQ = usePlansWithStats(false, false);
  const profileQ = useProfile();
  const userId = profileQ.data?.id ?? null;

  const allPlans: PlanWithStats[] = plansQ.data ?? [];

  // Three-way split. "mine" wins over "team" when both conditions could match.
  // Archived plans skip the ownership split — they get their own tab.
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

  const shown = bucket === "archived" ? archived : bucket === "team" ? team : mine;

  // Header stats are computed from the active book (mine + team) so opening
  // Archived doesn't make the eyebrow stats appear to "drop" — the portfolio
  // number is your present-day book.
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
    <>
      {/* Header — white bg, plum-tinted bottom border */}
      <header
        className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5 border-b border-[#D4CFE2] bg-white flex-shrink-0"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#8A80A8] whitespace-nowrap">
            {bucket === "archived" ? "Archived" : "Portfolio"}
          </p>
          <h1 className="mt-1 text-[22px] font-bold tracking-tight text-[#403770] whitespace-nowrap">
            All plans
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
        {/* Tab strip: My plans / Team plans / Archived plans */}
        <div
          className="flex gap-0 mb-[18px] border-b border-[#E2DEEC]"
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

        {/* Card grid — auto-fill at 320px minimum so wide viewports get 4+
            columns while a 320px sidebar still surfaces 1-2 cards cleanly.
            "mine" always renders the grid so NewPlanCard stays reachable even
            when the user has zero owned plans; team/archived fall back to
            EmptyBlock so the empty tab is unambiguous. */}
        {plansQ.isLoading ? (
          <Skeletons />
        ) : plansQ.isError ? (
          <ErrorBlock />
        ) : bucket !== "mine" && shown.length === 0 ? (
          <EmptyBlock bucket={bucket} />
        ) : (
          <div
            className="grid gap-[14px]"
            style={{
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            }}
          >
            {shown.map((p) => (
              <PlanCardPortfolio
                key={p.id}
                plan={p}
                archived={bucket === "archived"}
              />
            ))}
            {/* New-plan affordance only on My plans. A plan you create owns
                to you → lands here; showing it on Team would mislead, and on
                Archived is nonsensical. */}
            {bucket === "mine" && <NewPlanCard />}
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
  bucket: PortfolioBucket;
}
function EmptyBlock({ bucket }: EmptyBlockProps) {
  const { title, body } =
    bucket === "archived"
      ? {
          title: "No archived plans",
          body: "Plans you archive will appear here.",
        }
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
      <p className="text-sm font-semibold text-[#403770] whitespace-nowrap">
        {title}
      </p>
      <p className="mt-1 text-xs text-[#8A80A8]">{body}</p>
    </div>
  );
}
