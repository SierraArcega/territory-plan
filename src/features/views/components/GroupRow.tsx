"use client";

/**
 * GroupRow — single Plan or List row in the My Views sidebar.
 *
 * Renders the caret + accent (plan) / list icon + label + mini progress ring
 * (plan) or count (list). When expanded, plans show a meta line and both kinds
 * render their `GroupViewList` of indented view-type entries.
 *
 * Phase F adds:
 *   - Hover-revealed ⋯ button (120ms ease-out fade) that opens
 *     `GroupContextMenu`. Single open menu at a time, tracked by the
 *     `menuGroupId` store slice.
 *   - Inline-rename flow — clicking "Rename" in the menu flips the label
 *     into an `EditableText` input, then submits via useUpdateList /
 *     useUpdateTerritoryPlan on commit.
 *   - Hidden-row treatment — when `hidden` is true (parent passes it from
 *     the query response), the row dims to 55% opacity and shows a dashed
 *     left accent + "Unhide" inline action.
 */
import { useState } from "react";
import { ChevronDown, ListChecks, MoreHorizontal } from "lucide-react";
import {
  useViewsStore,
  selectIsGroupExpanded,
  selectMenuGroupId,
} from "../lib/store";
import { useViewsRouter } from "../hooks/useViewsRouter";
import type { GroupKind } from "../hooks/useViewsRouter";
import { VIEW_SPECS, type ViewId } from "../lib/view-types";
import GroupViewList from "./GroupViewList";
import GroupContextMenu from "./GroupContextMenu";
import EditableText from "@/features/shared/components/EditableText";
import { useUpdateList, useUnhideList, useUnhidePlan } from "../lib/queries";
import { useUpdateTerritoryPlan } from "@/features/plans/lib/queries";

/**
 * Deterministic accent picker — maps a plan id to one of three brand tints so
 * the sidebar always renders the same color for a given plan without needing
 * a column in the DB. Coral / Steel Blue / Sage.
 */
const PLAN_ACCENTS = ["#F37167", "#6EA3BE", "#69B34A"] as const;
function planAccent(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PLAN_ACCENTS[h % PLAN_ACCENTS.length];
}

/** Neutral list accent — plum-derived per tokens.md. */
const LIST_ACCENT = "#A69DC0";

interface GroupRowProps {
  kind: GroupKind;
  id: string;
  label: string;
  /** Plan-only: progress 0-100, or null when target is unset. */
  progress?: number | null;
  /** Plan-only: formatted target string ("$1.2M") to display in expanded meta. */
  target?: string | null;
  /** Plan-only: fiscal year label ("FY26"). */
  fiscal?: string | null;
  /** List-only: configured filter count → badge. */
  filterCount?: number;
  /** Default view to navigate to when a view child is clicked. */
  defaultViewId?: ViewId;
  /**
   * When true, render the row in the muted "hidden" treatment — 55% opacity,
   * dashed left accent, and an inline "Unhide" link. Only shown when the
   * sidebar has flipped `showHidden` so the user can opt back in.
   */
  hidden?: boolean;
  /** Per-view counts sourced from PlanWithStats — displayed as muted badges in the expanded view list. */
  viewCounts?: Partial<Record<ViewId, number>>;
}

export default function GroupRow({
  kind,
  id,
  label,
  progress,
  target,
  fiscal,
  filterCount,
  defaultViewId,
  hidden = false,
  viewCounts,
}: GroupRowProps) {
  const groupKey = `${kind}:${id}`;
  const isExpanded = useViewsStore(selectIsGroupExpanded(groupKey));
  const toggleGroup = useViewsStore((s) => s.toggleGroup);
  const menuGroupId = useViewsStore(selectMenuGroupId);
  const setMenuGroupId = useViewsStore((s) => s.setMenuGroupId);
  const router = useViewsRouter();

  const [isHovered, setIsHovered] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  const updateList = useUpdateList();
  const updatePlan = useUpdateTerritoryPlan();
  const unhideList = useUnhideList();
  const unhidePlan = useUnhidePlan();

  const isPlan = kind === "plan";
  const isActive = router.groupKind === kind && router.groupId === id;
  const isMenuOpen = menuGroupId === groupKey;
  const accentColor = isPlan ? planAccent(id) : LIST_ACCENT;

  // Visibility of the ⋯ button: appear on hover OR when the menu is open
  // (so it doesn't vanish out from under the user's cursor).
  const showDotsButton = isHovered || isMenuOpen;

  const handleRenameCommit = (next: string) => {
    setIsRenaming(false);
    const trimmed = next.trim();
    if (!trimmed || trimmed === label) return;
    if (isPlan) {
      updatePlan.mutate({ id, name: trimmed });
    } else {
      updateList.mutate({ id, data: { name: trimmed } });
    }
  };

  const handleUnhide = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPlan) {
      unhidePlan.mutate({ id });
    } else {
      unhideList.mutate({ id });
    }
  };

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ opacity: hidden ? 0.55 : 1 }}
    >
      {/* Header row — caret + accent + label + ring/count + ⋯ */}
      <div className="relative flex items-center">
        <button
          type="button"
          onClick={() => !isRenaming && toggleGroup(groupKey)}
          disabled={isRenaming}
          className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-left transition-colors duration-100 hover:bg-[#F7F5FA] ${
            isActive ? "bg-[#EFEDF5]" : ""
          }`}
          aria-expanded={isExpanded}
        >
          {/* Caret — rotates -90° when collapsed (150ms) */}
          <ChevronDown
            className="w-3 h-3 text-[#8A80A8] flex-shrink-0 transition-transform duration-150"
            style={{ transform: isExpanded ? "rotate(0)" : "rotate(-90deg)" }}
            aria-hidden
            strokeWidth={2}
          />

          {/* Plan accent bar (dashed when hidden) OR list icon */}
          {isPlan ? (
            <span
              className="w-[3px] h-3.5 rounded-sm flex-shrink-0"
              style={{
                background: hidden ? "transparent" : accentColor,
                border: hidden ? `1px dashed ${accentColor}` : "none",
              }}
              aria-hidden
            />
          ) : (
            <ListChecks
              className="w-3 h-3 flex-shrink-0"
              style={{ color: accentColor }}
              aria-hidden
              strokeWidth={2}
            />
          )}

          {/* Label — flips into EditableText during rename */}
          {isRenaming ? (
            <span
              className="flex-1 min-w-0"
              onClick={(e) => e.stopPropagation()}
            >
              <EditableText
                value={label}
                size="sm"
                weight="semibold"
                onChange={handleRenameCommit}
              />
            </span>
          ) : (
            <span className="flex-1 min-w-0 truncate whitespace-nowrap text-[13px] font-semibold text-[#403770]">
              {label}
            </span>
          )}

          {/* Plan-only: mini progress ring (hidden when ⋯ is hovered to
              avoid stacking visual noise). Lists show a filter-count badge. */}
          {!showDotsButton &&
            (isPlan ? (
              progress !== null && <ProgressRing pct={progress} />
            ) : (
              <span className="text-[10px] font-medium text-[#A69DC0] tabular-nums whitespace-nowrap">
                {typeof filterCount === "number" ? filterCount : ""}
              </span>
            ))}

          {/* Reserved 16px gutter where the ⋯ trigger fades in/out. */}
          <span className="w-4 h-4 flex-shrink-0" aria-hidden />
        </button>

        {/* ⋯ trigger — absolutely positioned over the right gutter. 120ms
            fade-in on hover; stays visible while the menu is open. */}
        {!isRenaming && (
          <button
            type="button"
            aria-label="Row actions"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={(e) => {
              e.stopPropagation();
              setMenuGroupId(isMenuOpen ? null : groupKey);
            }}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md border border-[#E2DEEC] bg-white p-1 text-[#8A80A8] hover:text-[#403770] transition-opacity duration-[120ms] ease-out"
            style={{
              opacity: showDotsButton ? 1 : 0,
              pointerEvents: showDotsButton ? "auto" : "none",
            }}
          >
            <MoreHorizontal className="w-3 h-3" aria-hidden strokeWidth={2.25} />
          </button>
        )}

        {/* Popover menu */}
        {isMenuOpen && (
          <GroupContextMenu
            kind={kind}
            id={id}
            label={label}
            onStartRename={() => setIsRenaming(true)}
          />
        )}
      </div>

      {/* Hidden-row inline "Unhide" link, shown only when hidden+expanded
          isn't required — the user must be looking at the row in showHidden
          mode for it to render at all. */}
      {hidden && (
        <div className="pl-[30px] pr-2 pb-1">
          <button
            type="button"
            onClick={handleUnhide}
            className="text-[10px] font-semibold text-[#F37167] hover:text-[#c25a52] transition-colors duration-100 whitespace-nowrap"
          >
            Unhide
          </button>
        </div>
      )}

      {/* Plan-only expanded meta line: `{pct}% of {target} · {fiscal}` */}
      {isPlan && isExpanded && (target || fiscal) && (
        <div className="flex items-center gap-1.5 pl-[30px] pr-2 pb-1 text-[10px] text-[#8A80A8] whitespace-nowrap">
          {typeof progress === "number" && (
            <>
              <span className="font-semibold text-[#403770] tabular-nums">
                {progress}%
              </span>
              {target && <span>of {target}</span>}
            </>
          )}
          {target && fiscal && <span className="text-[#D4CFE2]">·</span>}
          {fiscal && <span>{fiscal}</span>}
        </div>
      )}

      {/* Indented view list when expanded */}
      {isExpanded && (
        <GroupViewList
          kind={kind}
          groupId={id}
          activeViewId={isActive ? router.viewId : null}
          defaultViewId={defaultViewId ?? VIEW_SPECS[0].id}
          viewCounts={viewCounts}
        />
      )}
    </div>
  );
}

/**
 * Mini circular progress ring — 14px, stroke 2px. Color graduated by progress:
 *   ≥75% → success green (#69B34A)
 *   ≥50% → info blue (#6EA3BE)
 *   <50% → coral (#F37167)
 *
 * Renders as a closed track + colored arc. Uses pathLength=100 so we can set
 * stroke-dasharray with raw percentages without math.
 */
function ProgressRing({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const color =
    clamped >= 75 ? "#69B34A" : clamped >= 50 ? "#6EA3BE" : "#F37167";
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      className="flex-shrink-0"
      aria-label={`${clamped}%`}
      role="img"
    >
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke="#EFEDF5"
        strokeWidth="1.5"
      />
      <circle
        cx="7"
        cy="7"
        r="5.5"
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        pathLength={100}
        strokeDasharray={`${clamped} 100`}
        transform="rotate(-90 7 7)"
      />
    </svg>
  );
}
