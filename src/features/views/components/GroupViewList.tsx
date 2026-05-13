"use client";

/**
 * GroupViewList — indented list of the 8 view-type entries shown when a
 * plan or list is expanded in the sidebar.
 *
 * Every group exposes all 8 view types (from `VIEW_SPECS`); the chosen view
 * persists per-group to localStorage so reopening jumps back to where the
 * user left off (read in C2's GroupCanvas; written here on click).
 *
 * 30px left indent matches the prototype's visual rhythm: caret(11px) +
 * accent(3px) + small gaps land the view-icon column at ~30px.
 */
import { useViewsRouter } from "../hooks/useViewsRouter";
import type { GroupKind } from "../hooks/useViewsRouter";
import { VIEW_SPECS, type ViewId } from "../lib/view-types";

interface GroupViewListProps {
  kind: GroupKind;
  groupId: string;
  /** The currently active view id when this group is the active group. */
  activeViewId: ViewId | null;
  /**
   * Default view to use when no last-view-per-group is persisted. Reserved
   * for the row-level "open group" affordance Phase F introduces. The
   * per-view buttons here navigate to their own specific id, so this prop
   * is currently a contract marker only.
   */
  defaultViewId?: ViewId;
}

/** localStorage key for per-group last-view persistence. */
function lastViewKey(kind: GroupKind, id: string): string {
  return `view:lastView:${kind}:${id}`;
}

/** Persist the last-clicked view for this group. Best-effort — silent on quota. */
export function rememberLastView(
  kind: GroupKind,
  id: string,
  viewId: ViewId,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(lastViewKey(kind, id), viewId);
  } catch {
    // localStorage may throw in private mode or when quota is exceeded; the
    // sidebar UX gracefully degrades without persistence.
  }
}

/** Read the last-clicked view for this group, or null if none persisted. */
export function readLastView(kind: GroupKind, id: string): ViewId | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(lastViewKey(kind, id));
    if (!v) return null;
    // Defensive: verify it's still a valid view id (in case the registry
    // shrinks in a future release).
    const found = VIEW_SPECS.find((s) => s.id === v);
    return found ? found.id : null;
  } catch {
    return null;
  }
}

export default function GroupViewList({
  kind,
  groupId,
  activeViewId,
}: GroupViewListProps) {
  const router = useViewsRouter();

  return (
    <ul className="flex flex-col">
      {VIEW_SPECS.map((spec) => {
        const isActive = activeViewId === spec.id;
        const Icon = spec.icon;
        return (
          <li key={spec.id}>
            <button
              type="button"
              onClick={() => {
                rememberLastView(kind, groupId, spec.id);
                router.goToGroup(kind, groupId, spec.id);
              }}
              className={`w-full flex items-center gap-2 pl-[30px] pr-2 py-1 rounded-md text-left text-[12.5px] transition-colors duration-100 ${
                isActive
                  ? "bg-[#EFEDF5] text-[#403770] font-semibold"
                  : "text-[#5C5277] font-medium hover:bg-[#F7F5FA]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="w-3.5 h-3.5 flex-shrink-0"
                style={{ color: isActive ? "#F37167" : "#8A80A8" }}
                aria-hidden
                strokeWidth={2}
              />
              <span className="flex-1 min-w-0 truncate whitespace-nowrap">
                {spec.label}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export type { ViewId };
