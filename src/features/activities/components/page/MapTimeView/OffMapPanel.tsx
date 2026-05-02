"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import type { ActivityListItem } from "@/features/shared/types/api-types";
import {
  CATEGORY_LABELS,
  type ActivityCategory,
} from "@/features/activities/types";

const CATEGORY_DOT: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

type Tab = "offmap" | "virtual";

/**
 * Side panel listing activities that don't appear on the visible map. Two tabs:
 *  - Off-region: activities tied to a state/district outside the rendered area
 *  - Virtual: activities with no location at all
 */
export default function OffMapPanel({
  offMap,
  virtual,
  onActivityClick,
  onCollapse,
}: {
  offMap: ActivityListItem[];
  virtual: ActivityListItem[];
  onActivityClick: (id: string) => void;
  onCollapse?: () => void;
}) {
  const [tab, setTab] = useState<Tab>("offmap");
  const total = offMap.length + virtual.length;
  const items = tab === "offmap" ? offMap : virtual;

  return (
    <div className="w-[300px] flex-shrink-0 flex flex-col min-h-0 bg-white rounded-xl border border-[#E2DEEC]">
      <div className="px-3.5 py-3 border-b border-[#EFEDF5] flex items-start justify-between gap-2">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-[#8A80A8]">
            Not on map
          </div>
          <div className="mt-0.5 text-[13px] font-semibold text-[#403770]">
            {total === 0
              ? "Nothing outside map"
              : `${total} ${total === 1 ? "activity" : "activities"}`}
          </div>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            title="Collapse panel"
            className="w-6 h-6 inline-flex items-center justify-center rounded-md border border-[#E2DEEC] bg-white text-[#8A80A8] hover:text-[#403770] hover:border-[#D4CFE2] transition-colors duration-120 flex-shrink-0"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex px-2.5 pt-1.5 gap-1 border-b border-[#EFEDF5]">
        <TabBtn active={tab === "offmap"} onClick={() => setTab("offmap")}>
          Off-region · {offMap.length}
        </TabBtn>
        <TabBtn active={tab === "virtual"} onClick={() => setTab("virtual")}>
          Virtual · {virtual.length}
        </TabBtn>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1.5">
        {items.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[#8A80A8]">
            {tab === "offmap"
              ? "All activities with locations are within the visible map."
              : "No virtual or internal activities in this range."}
          </div>
        ) : (
          items.map((a) => (
            <Row
              key={a.id}
              activity={a}
              showState={tab === "offmap"}
              onClick={() => onActivityClick(a.id)}
            />
          ))
        )}
      </div>

      {total > 0 && <Breakdown items={items} />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1.5 text-[11px] -mb-px transition-colors duration-120 ${
        active
          ? "font-bold text-[#403770] border-b-2 border-[#403770]"
          : "font-medium text-[#8A80A8] border-b-2 border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

function Row({
  activity,
  showState,
  onClick,
}: {
  activity: ActivityListItem;
  showState?: boolean;
  onClick: () => void;
}) {
  const dot = CATEGORY_DOT[activity.category];
  const stateLabel =
    showState && activity.stateAbbrevs.length > 0
      ? activity.stateAbbrevs.slice(0, 2).join(" · ")
      : null;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-3.5 py-2 flex items-start gap-2.5 text-left border-b border-[#F7F5FA] last:border-b-0 hover:bg-[#FBF9FC] transition-colors duration-120"
    >
      <span
        className="w-2 h-2 rounded-full flex-shrink-0 mt-[5px]"
        style={{ backgroundColor: dot }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-semibold text-[#403770] truncate">
          {activity.title}
        </div>
        <div className="text-[10.5px] text-[#8A80A8] mt-0.5 tabular-nums">
          {activity.startDate
            ? format(new Date(activity.startDate), "MMM d · h:mm a")
            : "Unscheduled"}
          {stateLabel && (
            <>
              {" · "}
              <span className="text-[#6E6390]">{stateLabel}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

function Breakdown({ items }: { items: ActivityListItem[] }) {
  const counts = useMemo(() => {
    const m = new Map<ActivityCategory, number>();
    for (const a of items) {
      m.set(a.category, (m.get(a.category) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <div className="px-3.5 py-2 border-t border-[#EFEDF5] bg-[#FBF9FC] rounded-b-xl flex flex-wrap gap-2">
      {counts.map(([cat, n]) => (
        <span
          key={cat}
          className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#544A78]"
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: CATEGORY_DOT[cat] }}
          />
          {CATEGORY_LABELS[cat]} · {n}
        </span>
      ))}
    </div>
  );
}
