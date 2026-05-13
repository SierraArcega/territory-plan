"use client";

/**
 * PlanCardPortfolio — single plan tile rendered inside the /views portfolio
 * grid.
 *
 * Mirrors the prototype's card layout (see
 * `design_handoff_activities_calendar/design_handoff_saved_views/app-unified.jsx`
 * `PortfolioView`). Card visuals: white surface, 1px plum-tinted border,
 * 8px radius, 3px accent stripe across the top derived deterministically
 * from the plan id. Owner avatar (robin's-egg with plum initials), stats
 * row, and a 4px progress bar tinted by completion percentage.
 *
 * Behavior:
 *   - Click the body → navigate to `/views/plans/[id]/[lastView]`, falling
 *     back to the registry default when no per-plan view has been opened.
 *   - "Unarchive" link (Archived tab only) → flips status back to working.
 *
 * Phase F substitutes the portfolio's "Target / Booked / To target" header
 * stats for "Open pipeline / Total contacts / Open opps / Plans count"
 * because the territory-plans API does not yet expose target-derived
 * aggregates. Per-card "Total target" / "To target" follow the same rule
 * — see the README note in the implementer prompt. Stat omitted; pipeline
 * + districts + N contacts shown instead.
 */
import { useMemo } from "react";
import Link from "next/link";
import { Bookmark, Plus, Share2 } from "lucide-react";
import { useUpdateTerritoryPlan } from "@/features/plans/lib/queries";
import { readLastView } from "./GroupViewList";
import { DEFAULT_VIEW_ID } from "../lib/view-types";
import type { PlanWithStats } from "../lib/queries";

/** Plum-derived accent rotation — coral / steel blue / sage. */
const PLAN_ACCENTS = ["#F37167", "#6EA3BE", "#69B34A"] as const;

/**
 * Deterministically pick an accent color from the plan id. The same plan
 * always lands on the same color across reloads, but we don't need a
 * column in the DB to support it.
 */
function planAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PLAN_ACCENTS[h % PLAN_ACCENTS.length];
}

/** Initials of a name: "Sierra Arcega" → "SA". Falls back to "?" when empty. */
function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Convert a fiscal year integer to the short label ("FY26"). */
function fiscalLabel(year: number | null | undefined): string | null {
  if (!year || !Number.isFinite(year)) return null;
  return `FY${String(year).slice(-2)}`;
}

/** Compact dollar formatter ("$1.2M", "$622K", "$48"). */
function formatDollars(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
}

interface PlanCardPortfolioProps {
  plan: PlanWithStats;
  /** When true, render the Archived footer affordance instead of "8 views". */
  archived?: boolean;
  /** Optional override: number of saved views for this plan (v1.1 wiring). */
  viewCount?: number;
}

export default function PlanCardPortfolio({
  plan,
  archived = false,
  viewCount,
}: PlanCardPortfolioProps) {
  const updatePlan = useUpdateTerritoryPlan();

  const accent = useMemo(() => planAccent(plan.id), [plan.id]);
  const progress = Math.max(0, Math.min(100, plan.progress ?? 0));
  const progressColor =
    progress >= 75 ? "#69B34A" : progress >= 50 ? "#6EA3BE" : "#F37167";
  const progressLabelColor =
    progress >= 75 ? "#5f665b" : progress >= 50 ? "#4d7285" : "#c25a52";

  // Determine the per-user "last opened" view to land on. Falls back to the
  // registry default (Map) when nothing has been persisted yet.
  const targetView = readLastView("plan", plan.id) ?? DEFAULT_VIEW_ID;
  const href = `/views/plans/${encodeURIComponent(plan.id)}/${targetView}`;

  const handleUnarchive = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updatePlan.mutate({ id: plan.id, status: "working" });
  };

  // TODO(saved-views v1.1): replace placeholder "8 views" with real per-plan
  // saved-view count once the views-per-plan registry ships.
  const displayedViewCount = viewCount ?? 8;

  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-3 rounded-lg border border-[#D4CFE2] bg-white p-4 text-left transition-shadow duration-150 hover:shadow-[0_4px_6px_-1px_rgba(64,55,112,0.08)]"
      style={{ boxShadow: "0 1px 2px rgba(64,55,112,0.05)" }}
    >
      {/* 3px accent stripe across the top */}
      <span
        className="absolute left-0 right-0 top-0 h-[3px] rounded-t-lg"
        style={{ background: accent }}
        aria-hidden
      />

      {/* Header: fiscal eyebrow + plan name + owner avatar */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
            {fiscalLabel(plan.fiscalYear) ?? "Plan"}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-[16px] font-bold tracking-tight text-[#403770]">
            {plan.name}
          </p>
        </div>
        <span
          className="flex-shrink-0 inline-flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#C4E7E6] text-[10px] font-semibold text-[#403770]"
          aria-hidden
        >
          {initialsOf(plan.owner?.fullName)}
        </span>
      </div>

      {/* Stats row: districts + pipeline */}
      <div className="flex items-baseline justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
            Districts
          </p>
          <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[#403770] whitespace-nowrap">
            {plan.districtLeaids.length}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8A80A8] whitespace-nowrap">
            Pipeline
          </p>
          <p className="mt-0.5 text-[14px] font-semibold tabular-nums text-[#544A78] whitespace-nowrap">
            {formatDollars(plan.pipelineValue)}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="font-medium text-[#8A80A8] whitespace-nowrap">
            Progress
          </span>
          <span
            className="font-semibold tabular-nums whitespace-nowrap"
            style={{ color: progressLabelColor }}
          >
            {progress}%
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-[#EFEDF5] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{ width: `${progress}%`, background: progressColor }}
          />
        </div>
      </div>

      {/* Footer: views count + shared badge + unarchive (archived only) */}
      <div className="flex items-center gap-1.5 pt-2 border-t border-[#EFEDF5] text-[11px] text-[#8A80A8]">
        <Bookmark
          className="w-3 h-3 flex-shrink-0"
          aria-hidden
          strokeWidth={2}
        />
        <span className="whitespace-nowrap">{displayedViewCount} views</span>
        {/* Plans don't track `shared` today — render only when the API exposes it. */}
        {Boolean((plan as unknown as { shared?: boolean }).shared) && (
          <>
            <span className="text-[#D4CFE2]" aria-hidden>·</span>
            <Share2
              className="w-3 h-3 flex-shrink-0"
              aria-hidden
              strokeWidth={2}
            />
            <span className="whitespace-nowrap">Shared</span>
          </>
        )}
        {archived && (
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={updatePlan.isPending}
            className="ml-auto whitespace-nowrap text-[11px] font-semibold text-[#F37167] hover:text-[#c25a52] transition-colors duration-100 disabled:opacity-60"
          >
            Unarchive
          </button>
        )}
      </div>
    </Link>
  );
}

/**
 * "New plan" dashed card — only rendered on the Active tab. v1.1 should port
 * the inline new-plan form into /views; until then we deep-link to the
 * legacy `/?tab=plans` page where the existing creation modal lives.
 *
 * TODO(saved-views v1.1): replace this link with an inline new-plan form so
 * users don't context-switch back to the legacy shell to create a plan.
 */
export function NewPlanCard() {
  return (
    <Link
      href="/?tab=plans"
      className="flex min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[#D4CFE2] bg-transparent p-4 text-center text-[13px] font-medium text-[#8A80A8] hover:text-[#403770] hover:border-[#403770] transition-colors duration-100"
    >
      <Plus className="w-5 h-5" aria-hidden strokeWidth={2} />
      <span className="whitespace-nowrap">New plan</span>
    </Link>
  );
}
