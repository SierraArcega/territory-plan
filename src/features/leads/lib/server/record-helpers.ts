import prisma from "@/lib/prisma";
import { ENGAGEMENT_SOURCE_FILTER } from "./timeline-items";
import { ACTIVE_LEAD_STATUSES } from "./lead-service";

/**
 * Shared helpers for the record-panel aggregate routes
 * (/api/leads/records/{contact|school|district}/[id]).
 *
 * "Points" on these panels = the engagement score accumulated on the record's
 * lead(s) (leads.score, incremented by logEngagement). Real activities carry
 * no per-activity points column, so the lead score is the single source of
 * truth for engagement points; a record's Points stat sums its leads' scores.
 */

/** Timeline rows returned per panel (CLAUDE.md: never render >50 at once). */
export const RECORD_TIMELINE_LIMIT = 50;

/** List rows returned per panel section (CLAUDE.md pagination rule). */
export const RECORD_LIST_LIMIT = 50;

/** A contact's displayed lead status: active lead first, else most recent. */
export function pickLeadStatus(leads: { status: string }[]): string | null {
  const active = leads.find((l) =>
    (ACTIVE_LEAD_STATUSES as readonly string[]).includes(l.status),
  );
  return (active ?? leads[0])?.status ?? null;
}

/** Engagement-activity counts keyed by contact id (one grouped query). */
export async function countActivitiesByContact(
  contactIds: number[],
): Promise<Map<number, number>> {
  if (contactIds.length === 0) return new Map();
  const grouped = await prisma.activityContact.groupBy({
    by: ["contactId"],
    where: {
      contactId: { in: contactIds },
      activity: ENGAGEMENT_SOURCE_FILTER,
    },
    _count: { activityId: true },
  });
  return new Map(grouped.map((g) => [g.contactId, g._count.activityId]));
}

/** Engagement-activity counts keyed by school ncessch (one grouped query). */
export async function countActivitiesBySchool(
  ncesschIds: string[],
): Promise<Map<string, number>> {
  if (ncesschIds.length === 0) return new Map();
  const grouped = await prisma.activitySchool.groupBy({
    by: ["ncessch"],
    where: {
      ncessch: { in: ncesschIds },
      activity: ENGAGEMENT_SOURCE_FILTER,
    },
    _count: { activityId: true },
  });
  return new Map(grouped.map((g) => [g.ncessch, g._count.activityId]));
}
