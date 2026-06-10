import type { Prisma } from "@prisma/client";

/**
 * Shared timeline-item serialization for the lead timeline route and the
 * record-panel aggregate routes (/api/leads/records/*). One select + one
 * mapper so every surface renders the exact same engagement shape.
 *
 * Engagement items are attributed so the UI can flag the non-obvious ones:
 *  - own_contact:   touches the record's own contact (left unlabeled)
 *  - other_contact: a different contact (shows that contact's name chip)
 *  - district_wide: no contact at all (district/school-level signal);
 *    attributionName may override the chip label (e.g. "School-wide")
 */
export type TimelineAttribution = "own_contact" | "other_contact" | "district_wide";

/** Engagement = real activities; "system" rows are sync noise, not engagement. */
export const ENGAGEMENT_SOURCE_FILTER = { source: { not: "system" } } as const;

export const ENGAGEMENT_ACTIVITY_SELECT = {
  id: true,
  type: true,
  title: true,
  notes: true,
  outcome: true,
  outcomeType: true,
  rating: true,
  // metadata.leadPoints = points this activity carried (logEngagement/import).
  metadata: true,
  // Mixmax enrichment — populated historically by the (now removed) Mixmax
  // sync; rendered only when present.
  mixmaxSequenceName: true,
  mixmaxSequenceStep: true,
  mixmaxSequenceTotal: true,
  mixmaxOpenCount: true,
  mixmaxClickCount: true,
  source: true,
  startDate: true,
  createdAt: true,
  createdByUserId: true,
  contacts: {
    select: { contactId: true, contact: { select: { name: true } } },
  },
} as const satisfies Prisma.ActivitySelect;

export type EngagementActivityRow = Prisma.ActivityGetPayload<{
  select: typeof ENGAGEMENT_ACTIVITY_SELECT;
}>;

export interface EngagementItem {
  itemType: "engagement";
  id: string;
  type: string;
  title: string;
  notes: string | null;
  outcome: string | null;
  outcomeType: string | null;
  rating: number | null;
  /** Points this activity carried toward the lead score (metadata.leadPoints). */
  points: number;
  mixmaxSequenceName: string | null;
  mixmaxSequenceStep: number | null;
  mixmaxSequenceTotal: number | null;
  mixmaxOpenCount: number | null;
  mixmaxClickCount: number | null;
  source: string;
  createdByUserId: string | null;
  attribution: TimelineAttribution;
  attributionName: string | null;
  ts: string;
}

/** metadata.leadPoints, defensively parsed (metadata is a free-form jsonb). */
function leadPoints(metadata: Prisma.JsonValue | null): number {
  if (metadata == null || typeof metadata !== "object" || Array.isArray(metadata)) {
    return 0;
  }
  const v = (metadata as Record<string, unknown>).leadPoints;
  return typeof v === "number" && Number.isInteger(v) ? v : 0;
}

/**
 * Attribute an activity relative to a contact "viewpoint" (the lead's contact,
 * or the record panel's contact). Pass `ownContactId: null` for record panels
 * with no single own contact (district/school) — every contact-linked activity
 * then shows that contact's name chip.
 */
export function attributeActivity(
  activity: EngagementActivityRow,
  ownContactId: number | null,
): { attribution: TimelineAttribution; attributionName: string | null } {
  if (ownContactId != null && activity.contacts.some((c) => c.contactId === ownContactId)) {
    return { attribution: "own_contact", attributionName: null };
  }
  if (activity.contacts.length > 0) {
    return { attribution: "other_contact", attributionName: activity.contacts[0].contact.name };
  }
  return { attribution: "district_wide", attributionName: null };
}

export function toEngagementItem(
  activity: EngagementActivityRow,
  attribution: TimelineAttribution,
  attributionName: string | null,
): EngagementItem {
  return {
    itemType: "engagement",
    id: activity.id,
    type: activity.type,
    title: activity.title,
    notes: activity.notes,
    outcome: activity.outcome,
    outcomeType: activity.outcomeType,
    rating: activity.rating,
    points: leadPoints(activity.metadata),
    mixmaxSequenceName: activity.mixmaxSequenceName,
    mixmaxSequenceStep: activity.mixmaxSequenceStep,
    mixmaxSequenceTotal: activity.mixmaxSequenceTotal,
    mixmaxOpenCount: activity.mixmaxOpenCount,
    mixmaxClickCount: activity.mixmaxClickCount,
    source: activity.source,
    createdByUserId: activity.createdByUserId,
    attribution,
    attributionName,
    ts: (activity.startDate ?? activity.createdAt).toISOString(),
  };
}

export interface LifecycleItem {
  itemType: "lifecycle";
  id: string;
  kind: string;
  payload: Prisma.JsonValue | null;
  actorId: string | null;
  ts: string;
}

export interface LeadEventRow {
  id: string;
  kind: string;
  payload: Prisma.JsonValue | null;
  actorId: string | null;
  createdAt: Date;
}

export function toLifecycleItem(event: LeadEventRow): LifecycleItem {
  return {
    itemType: "lifecycle",
    id: event.id,
    kind: event.kind,
    payload: event.payload,
    actorId: event.actorId,
    ts: event.createdAt.toISOString(),
  };
}

export type TimelineItem = EngagementItem | LifecycleItem;

/** Newest-first sort shared by every timeline-returning route. */
export function sortTimelineDesc<T extends { ts: string }>(items: T[]): T[] {
  return items.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));
}
