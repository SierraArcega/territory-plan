"use client";

/**
 * Plans subsection of the My Views sidebar.
 *
 * Header: target icon + "Plans" + right-aligned "FY26" pill.
 * Body: real `GroupRow` entries for every visible (non-hidden) plan returned by
 *       `usePlansWithStats()`.
 *
 * Loading / error / empty states match the prototype: skeleton rows while
 * loading, a single muted retry line on error, and a tiny "No plans yet" line
 * when the API returns an empty array.
 *
 * Hidden plans are filtered client-side here (the API also supports filtering
 * via ?showHidden=1 in queries.ts; the store's `showHidden` flag flips the
 * fetch). When the user toggles "Show hidden", hidden plans rejoin the list
 * with a slightly muted look — that's handled by the parent in Phase F.
 */
import { Target } from "lucide-react";
import {
  usePlansWithStats,
  type PlanWithStats,
} from "../lib/queries";
import { useViewsStore, selectShowHidden } from "../lib/store";
import GroupRow from "./GroupRow";

/** Format a numeric target into a compact dollar string ("$1.2M"). */
function formatTarget(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value)) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

/**
 * Type guard for the optional `target` field. The shared `PlanWithStats`
 * shape declared in queries.ts is conservative — many plan rows in dev DBs
 * lack a target. We render the target when present, otherwise the meta line
 * collapses gracefully.
 */
function readTarget(plan: PlanWithStats): number | null {
  // Look for both casing variants since downstream API tweaks have flopped
  // between camelCase and snake_case at various points in this project.
  const maybe = plan as unknown as {
    target?: number | null;
    targetAmount?: number | null;
  };
  if (typeof maybe.target === "number") return maybe.target;
  if (typeof maybe.targetAmount === "number") return maybe.targetAmount;
  return null;
}

function readFiscalLabel(plan: PlanWithStats): string | null {
  if (!plan.fiscalYear) return null;
  // Convert 2026 → "FY26" to match the prototype.
  const yy = String(plan.fiscalYear).slice(-2);
  return `FY${yy}`;
}

export default function PlansSubsection() {
  const showHidden = useViewsStore(selectShowHidden);
  const plansQ = usePlansWithStats(showHidden);

  const visiblePlans = (plansQ.data ?? []).filter((p) =>
    showHidden ? true : !p.hidden,
  );

  return (
    <section className="mt-3">
      {/* Subsection header: target icon + label + FY26 right side */}
      <header className="flex items-center justify-between px-2 mb-1">
        <div className="flex items-center gap-1.5">
          <Target
            className="w-3.5 h-3.5 text-[#544A78]"
            aria-hidden
            strokeWidth={2}
          />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[#403770] whitespace-nowrap">
            Plans
          </span>
        </div>
        <span className="text-[10px] font-medium text-[#A69DC0] whitespace-nowrap">
          FY26
        </span>
      </header>

      <Body
        isLoading={plansQ.isLoading}
        isError={plansQ.isError}
        plans={visiblePlans}
      />
    </section>
  );
}

interface BodyProps {
  isLoading: boolean;
  isError: boolean;
  plans: PlanWithStats[];
}

function Body({ isLoading, isError, plans }: BodyProps) {
  if (isLoading) {
    return (
      <ul aria-busy="true">
        {Array.from({ length: 3 }).map((_, i) => (
          <li
            key={i}
            className="flex items-center gap-2 px-2 py-1.5"
            aria-hidden
          >
            <span className="w-3 h-3 flex-shrink-0" />
            <span className="w-[3px] h-3.5 rounded-sm bg-[#EFEDF5] flex-shrink-0" />
            <span className="flex-1 min-w-0 h-3 rounded-md bg-[#F7F5FA] animate-pulse" />
          </li>
        ))}
      </ul>
    );
  }

  if (isError) {
    return (
      <div className="px-2 py-1.5 text-[11px] text-[#8A80A8] whitespace-nowrap">
        Couldn&apos;t load plans
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="px-2 py-1.5 text-[11px] text-[#8A80A8] whitespace-nowrap">
        No plans yet
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {plans.map((p) => (
        <li key={p.id}>
          <GroupRow
            kind="plan"
            id={p.id}
            label={p.name}
            progress={p.progress ?? null}
            target={formatTarget(readTarget(p))}
            fiscal={readFiscalLabel(p)}
            hidden={p.hidden}
            viewCounts={{
              map:      p.districtLeaids.length,
              table:    p.districtLeaids.length,
              kanban:   p.oppsCount,
              contacts: p.contactsCount,
              opps:     p.oppsCount,
              signals:  p.recentNewsCount,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
