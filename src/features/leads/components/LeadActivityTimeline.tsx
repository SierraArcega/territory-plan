"use client";

// Lead activity timeline — the merged feed for the detail panel: the lead's
// own lifecycle events (system feel, Zap icon, flat rows) plus shared
// engagement activities touching its contact / school / district. Engagement
// rows follow the activity-card treatment from the design handoff
// (LeadActivity.jsx): a source-colored icon badge, a bordered white card with
// type label + title (+ LinkageChip when the source is non-obvious), the
// Mixmax sequence badge / open-click stats when the sync populated them, the
// logged outcome pill + star rating, the notes box, and a right-aligned
// "+N pts" when the activity carried points. The exported TimelineList
// renders any pre-fetched item array, so the record panels (ContactRecord /
// SchoolRecord / DistrictRecord) reuse the exact rows.

import type { LucideIcon } from "lucide-react";
import { Calendar, Gift, Mail, Phone, Target, Users, Zap } from "lucide-react";
import { fmtRel } from "@/features/shared/lib/date-utils";
import { ACTIVITY_TYPE_LABELS, type ActivityType } from "@/features/activities/types";
import { useLeadTimelineQuery } from "@/features/leads/lib/queries";
import {
  OUTCOME_PILLS,
  STATUS_CONFIG,
  OPP_ADVANCED_MESSAGE,
} from "@/features/leads/lib/status-config";
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

// Source-colored badge palette — mirrors SOURCE_CONFIG in
// features/activities/components/ActivityTimelineItem.tsx (manual plum-tuned
// to the handoff's steel).
const SOURCE_BADGES: Record<string, { bg: string; name: string }> = {
  gmail_sync: { bg: "#EA4335", name: "Gmail" },
  calendar_sync: { bg: "#4285F4", name: "Calendar" },
  slack_sync: { bg: "#4A154B", name: "Slack" },
  manual: { bg: "#6EA3BE", name: "Logged manually" },
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

/** Lifecycle (system) row — flat HistoryRow styling, unchanged by design. */
function LifecycleRow({
  item,
  first,
  now,
}: {
  item: LifecycleTimelineItem;
  first: boolean;
  now?: Date;
}) {
  return (
    <div
      className={`flex gap-3 py-[11px] ${first ? "" : "border-t border-[#EFEDF5]"}`}
      data-testid="timeline-lifecycle"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2DEEC]"
        style={{ background: "#EFEDF5", color: "#6E6390" }}
      >
        <Zap size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold leading-[1.35] text-[#403770]">
          {lifecycleText(item)}
        </div>
        <div className="mt-0.5 text-[11px] text-[#A69DC0]">{fmtRel(item.ts, now)}</div>
      </div>
    </div>
  );
}

/** Engagement row — the prototype's bordered activity card (LeadActivity.jsx). */
function EngagementRow({ item, now }: { item: EngagementTimelineItem; now?: Date }) {
  const Icon: LucideIcon = ENGAGEMENT_ICONS[item.type as ActivityType] ?? Target;
  const badge = SOURCE_BADGES[item.source] ?? SOURCE_BADGES.manual;
  const outcome = item.outcomeType
    ? OUTCOME_PILLS.find((o) => o.key === item.outcomeType)
    : undefined;
  const rating =
    item.rating != null && item.rating >= 1 && item.rating <= 5 ? item.rating : 0;
  const opens = item.mixmaxOpenCount ?? 0;
  const clicks = item.mixmaxClickCount ?? 0;
  return (
    <div className="flex gap-3 py-[5px]" data-testid="timeline-engagement">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: badge.bg }}
        title={badge.name}
      >
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1 rounded-lg border border-[#E2DEEC] bg-white px-[11px] py-[9px]">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.05em] text-[#A69DC0]">
            {ACTIVITY_TYPE_LABELS[item.type as ActivityType] ?? "Activity"}
          </span>
          <span className="min-w-0 text-[13px] font-semibold leading-[1.35] text-[#403770] [overflow-wrap:anywhere]">
            {item.title}
          </span>
          <LinkageChip attribution={item.attribution} name={item.attributionName} />
        </div>

        {/* Mixmax sequence badge (sync-populated; rendered only when real) */}
        {item.mixmaxSequenceName && (
          <div className="mt-[5px]">
            <span className="inline-flex items-center whitespace-nowrap rounded-full bg-[#FFF3F0] px-2 py-px text-[10px] font-semibold text-[#FF6B4A]">
              {item.mixmaxSequenceStep != null && item.mixmaxSequenceTotal != null
                ? `Step ${item.mixmaxSequenceStep}/${item.mixmaxSequenceTotal}`
                : "Sequence"}
              {" · "}
              {item.mixmaxSequenceName}
            </span>
          </div>
        )}

        {/* Logged outcome pill + star rating */}
        {(outcome || rating > 0) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {outcome && (
              <span
                className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-[9px] py-0.5 text-[11px] font-semibold"
                style={{ background: outcome.bg, color: outcome.color }}
              >
                <span aria-hidden>{outcome.icon}</span>
                {outcome.label}
              </span>
            )}
            {rating > 0 && (
              <span
                className="text-[11px] tracking-[1px] text-[#D4A84B]"
                aria-label={`Rated ${rating} of 5`}
              >
                {"★".repeat(rating)}
                <span className="text-[#E2DEEC]">{"★".repeat(5 - rating)}</span>
              </span>
            )}
          </div>
        )}

        {/* Notes */}
        {item.notes && (
          <div className="mt-[7px] rounded-[7px] border border-[#EDEAF4] bg-[#FAF8FC] px-[9px] py-[7px] text-xs leading-[1.45] text-[#5C5277]">
            {item.notes}
          </div>
        )}

        {/* Detail line: time + engagement stats + points */}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[#A69DC0]">
          <span className="whitespace-nowrap">{fmtRel(item.ts, now)}</span>
          {(opens > 0 || clicks > 0) && (
            <>
              <span aria-hidden>·</span>
              {opens > 0 && <span className="whitespace-nowrap">Opened {opens}x</span>}
              {opens > 0 && clicks > 0 && <span aria-hidden>·</span>}
              {clicks > 0 && <span className="whitespace-nowrap">Clicked {clicks}x</span>}
            </>
          )}
          {item.points > 0 && (
            <span className="ml-auto whitespace-nowrap font-bold tabular-nums text-[#56792F]">
              +{item.points} pts
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineRow({
  item,
  first,
  now,
}: {
  item: LeadTimelineItem;
  first: boolean;
  now?: Date;
}) {
  return item.itemType === "lifecycle" ? (
    <LifecycleRow item={item} first={first} now={now} />
  ) : (
    <EngagementRow item={item} now={now} />
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
