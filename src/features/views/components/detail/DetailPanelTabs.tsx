"use client";

/**
 * DetailPanelTabs — district-only sub-navigation.
 *
 * The prototype's district panel ships four tabs (Overview / Contacts /
 * Pipeline / Activity). Other entity kinds render a single body and don't
 * mount this strip. Each tab is a 12px-bold button with a 2px plum bottom
 * border on the active tab; inactive tabs use the Secondary text token.
 *
 * State is held by the caller (DistrictDetailContent owns the active tab so
 * the panel can re-render on tab change without dragging that state into the
 * URL — district sub-tab choice is intentionally non-shareable in v1).
 */
import type { ReactNode } from "react";

export type DistrictDetailTab = "overview" | "contacts" | "pipeline" | "activity";

const TABS: readonly { id: DistrictDetailTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "contacts", label: "Contacts" },
  { id: "pipeline", label: "Pipeline" },
  { id: "activity", label: "Activity" },
];

export interface DetailPanelTabsProps {
  active: DistrictDetailTab;
  onSelect: (tab: DistrictDetailTab) => void;
  /** Optional right-side adornment (e.g. count badge) — defers to v1.1. */
  trailing?: ReactNode;
}

export default function DetailPanelTabs({
  active,
  onSelect,
  trailing,
}: DetailPanelTabsProps) {
  return (
    <div className="flex items-center gap-0.5 px-[18px] border-b border-[#E2DEEC]">
      <div className="flex flex-1 min-w-0 overflow-x-auto">
        {TABS.map((t) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={
                "py-2.5 px-1 mr-3.5 -mb-px border-b-2 text-xs whitespace-nowrap transition-colors duration-100 " +
                (isActive
                  ? "border-[#403770] text-[#403770] font-semibold"
                  : "border-transparent text-[#8A80A8] font-medium hover:text-[#544A78]")
              }
              aria-pressed={isActive}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {trailing}
    </div>
  );
}
