"use client";

/**
 * ViewTabsStrip — horizontal tab strip for the 8 view types below the
 * GroupHeader.
 *
 * Behavior:
 *   - Each tab navigates to /views/{kind plural}/{id}/{viewId}.
 *   - The active tab has a 2px plum bottom border + 600 weight.
 *   - Inactive tabs are #8A80A8.
 *   - A `+ View` affordance lives at the end. v1 is a no-op (custom views
 *     are deferred to v1.1).
 *   - Per-group last-view persistence: on click, we store the chosen view to
 *     localStorage under `view:lastView:{kind}:{id}` (same key family used by
 *     GroupViewList in the sidebar).
 *   - Overflow: the row scrolls horizontally on narrow widths to keep all 8
 *     tabs reachable per CLAUDE.md narrow-width resilience.
 */
import { Plus } from "lucide-react";
import { useViewsRouter } from "../hooks/useViewsRouter";
import type { GroupKind } from "../hooks/useViewsRouter";
import { VIEW_SPECS, type ViewId } from "../lib/view-types";
import { rememberLastView } from "./GroupViewList";

interface ViewTabsStripProps {
  kind: GroupKind;
  groupId: string;
  activeViewId: ViewId;
}

export default function ViewTabsStrip({
  kind,
  groupId,
  activeViewId,
}: ViewTabsStripProps) {
  const router = useViewsRouter();

  return (
    <div className="relative bg-white border-b border-[#D4CFE2] -mt-px flex-shrink-0">
      <div
        // Negative margin -1px aligns the active tab's 2px bottom border with
        // the strip's bottom border for a continuous underline.
        className="flex items-center gap-0.5 px-3 overflow-x-auto whitespace-nowrap"
        // pan-y on a horizontally-scrolling rail is harmless and helps iOS
        // touch routing per CLAUDE.md mobile guidance.
        style={{ touchAction: "pan-y" }}
      >
        {VIEW_SPECS.map((spec) => {
          const isActive = spec.id === activeViewId;
          const Icon = spec.icon;
          return (
            <button
              key={spec.id}
              type="button"
              onClick={() => {
                rememberLastView(kind, groupId, spec.id);
                router.goToGroup(kind, groupId, spec.id);
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-2 -mb-px text-[12px] transition-colors duration-100 ${
                isActive
                  ? "text-[#403770] font-semibold border-b-2 border-[#403770]"
                  : "text-[#8A80A8] font-medium border-b-2 border-transparent hover:text-[#403770]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon
                className="w-3 h-3 flex-shrink-0"
                style={{ color: isActive ? "#F37167" : "#A69DC0" }}
                aria-hidden
                strokeWidth={2}
              />
              <span className="whitespace-nowrap">{spec.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          // v1: + View is a stub. Phase F decides whether to wire this to a
          // custom-view editor or remove it for v1 shipping.
          onClick={() => undefined}
          className="inline-flex items-center gap-1 px-2.5 py-2 -mb-px text-[12px] font-medium text-[#A69DC0] hover:text-[#403770] transition-colors duration-100 border-b-2 border-transparent"
          aria-label="Add custom view"
          title="Add custom view (coming soon)"
        >
          <Plus className="w-3 h-3" aria-hidden />
          <span className="whitespace-nowrap">View</span>
        </button>
      </div>
    </div>
  );
}
