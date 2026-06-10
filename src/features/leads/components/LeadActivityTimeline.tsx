"use client";

// Lead activity timeline — the merged feed for the detail panel: the lead's
// own lifecycle events (system feel, Zap icon) plus shared engagement
// activities touching its contact / school / district. Rows follow the
// HistoryRow pattern from the design handoff (LeadBits.jsx): a 28px icon
// tile, a 13px plum text line, an fmtRel timestamp, and — only when the
// source is non-obvious — a linkage chip (LinkageChip). The exported
// TimelineList renders any pre-fetched item array, so the record panels
// (ContactRecord / SchoolRecord / DistrictRecord) reuse the exact rows.

import type { LucideIcon } from "lucide-react";
import { Calendar, Gift, Mail, Phone, Target, Users, Zap } from "lucide-react";
import { fmtRel } from "@/features/shared/lib/date-utils";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/features/activities/types";
import { useLeadTimelineQuery } from "@/features/leads/lib/queries";
import { STATUS_CONFIG, OPP_ADVANCED_MESSAGE } from "@/features/leads/lib/status-config";
import type {
  LeadStatus,
  LeadTimelineItem,
  LifecycleTimelineItem,
  EngagementTimelineItem,
} from "@/features/leads/lib/types";
import LinkageChip from "./bits/LinkageChip";

// ---- Icons ------------------------------------------------------------------

const ENGAGEMENT_ICONS: Partial<Record<ActivityType, LucideIcon>> = {
  email: Mail,
  mixmax_campaign: Mail,
  cold_call: Phone,
  discovery_call: Calendar,
  program_check_in: Calendar,
  proposal_review: Calendar,
  renewal_conversation: Calendar,
  webinar: Users,
  conference: Users,
  speaking_engagement: Users,
  professional_development: Users,
  course: Users,
  gift_drop: Gift,
};

// ---- Lifecycle copy -----------------------------------------------------------

function payloadString(
  payload: Record<string, unknown> | null,
  key: string,
): string | null {
  const v = payload?.[key];
  return typeof v === "string" && v ? v : null;
}

/** Human copy for a lead_events row, derived from kind + payload. */
export function lifecycleText(item: LifecycleTimelineItem): string {
  const { kind, payload } = item;
  switch (kind) {
    case "created":
      return "Lead created";
    case "accepted":
      return "Lead accepted · status → Working";
    case "restaged": {
      const to = payloadString(payload, "to");
      const label = to ? STATUS_CONFIG[to as LeadStatus]?.label : null;
      return label ? `Moved to ${label}` : "Stage changed";
    }
    case "opp_created":
      return payloadString(payload, "mode") === "linked"
        ? "Linked to opportunity"
        : "Stage 0 opportunity created";
    case "opp_advanced":
      return payloadString(payload, "message") ?? OPP_ADVANCED_MESSAGE;
    case "disqualified": {
      const reason = payloadString(payload, "reason");
      const message = payloadString(payload, "message");
      return ["Lead disqualified", reason, message].filter(Boolean).join(" · ");
    }
    case "note":
      return payloadString(payload, "message") ?? "Note";
    default:
      return kind;
  }
}

// ---- Rows --------------------------------------------------------------------

function TimelineRow({
  item,
  first,
  now,
}: {
  item: LeadTimelineItem;
  first: boolean;
  now?: Date;
}) {
  const sys = item.itemType === "lifecycle";
  const Icon: LucideIcon = sys
    ? Zap
    : (ENGAGEMENT_ICONS[(item as EngagementTimelineItem).type as ActivityType] ?? Target);
  return (
    <div
      className={`flex gap-3 py-[11px] ${first ? "" : "border-t border-[#EFEDF5]"}`}
      data-testid={sys ? "timeline-lifecycle" : "timeline-engagement"}
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2DEEC]"
        style={
          sys
            ? { background: "#EFEDF5", color: "#6E6390" }
            : { background: "#FFFCFA", color: "#6EA3BE" }
        }
      >
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        {sys ? (
          <div className="text-[13px] font-semibold leading-[1.35] text-[#403770]">
            {lifecycleText(item)}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
              <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.05em] text-[#A69DC0]">
                {ACTIVITY_TYPE_LABELS[item.type as ActivityType] ?? "Activity"}
              </span>
              <span className="min-w-0 text-[13px] font-medium leading-[1.35] text-[#403770] [overflow-wrap:anywhere]">
                {item.title}
              </span>
              <LinkageChip attribution={item.attribution} name={item.attributionName} />
            </div>
            {item.notes && (
              <div className="mt-[7px] rounded-[7px] border border-[#EDEAF4] bg-[#FAF8FC] px-[9px] py-[7px] text-xs leading-[1.45] text-[#5C5277]">
                {item.notes}
              </div>
            )}
          </>
        )}
        <div className="mt-0.5 text-[11px] text-[#A69DC0]">{fmtRel(item.ts, now)}</div>
      </div>
    </div>
  );
}

// ---- Lists ---------------------------------------------------------------------

interface TimelineListProps {
  items: LeadTimelineItem[];
  emptyText?: string;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Renders a pre-fetched item array — shared with the record panels. */
export function TimelineList({ items, emptyText = "No activity yet.", now }: TimelineListProps) {
  if (items.length === 0) {
    return <div className="py-2 text-[12.5px] text-[#A69DC0]">{emptyText}</div>;
  }
  return (
    <div>
      {items.map((item, i) => (
        <TimelineRow key={item.id} item={item} first={i === 0} now={now} />
      ))}
    </div>
  );
}

export function TimelineSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden data-testid="timeline-skeleton">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`flex gap-3 py-[11px] ${i === 0 ? "" : "border-t border-[#EFEDF5]"}`}
        >
          <div className="h-7 w-7 shrink-0 animate-pulse rounded-lg bg-[#EFEDF5]" />
          <div className="min-w-0 flex-1">
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-[#EFEDF5]" />
            <div className="mt-2 h-2.5 w-16 animate-pulse rounded-full bg-[#F4F2F8]" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface LeadActivityTimelineProps {
  leadId: string;
  /** Injectable clock for tests. */
  now?: Date;
}

/** Fetches and renders the merged lead timeline (lifecycle + engagement). */
export default function LeadActivityTimeline({ leadId, now }: LeadActivityTimelineProps) {
  const { data, isLoading, isError, refetch } = useLeadTimelineQuery(leadId);

  if (isLoading) return <TimelineSkeleton />;
  if (isError) {
    return (
      <div className="flex items-center gap-2 py-2 text-[12.5px] text-[#C25A52]">
        <span className="whitespace-nowrap">Couldn&apos;t load activity.</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="whitespace-nowrap font-semibold underline-offset-2 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }
  return <TimelineList items={data?.items ?? []} now={now} />;
}
