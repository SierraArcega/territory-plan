import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  ENGAGEMENT_ACTIVITY_SELECT,
  ENGAGEMENT_SOURCE_FILTER,
  sortTimelineDesc,
  toEngagementItem,
} from "@/features/leads/lib/server/timeline-items";
import { ACTIVE_LEAD_STATUSES } from "@/features/leads/lib/server/lead-service";
import { RECORD_TIMELINE_LIMIT } from "@/features/leads/lib/server/record-helpers";

export const dynamic = "force-dynamic";

// GET /api/leads/records/contact/[id] — everything the Contact record panel
// needs in one fetch: details, workplace school + district, the contact's
// lead (active preferred, else most recent), engagement stats, and the full
// contact activity timeline.
//
// "Points" = the lead-score sum — see lib/server/record-helpers.ts.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const contactId = Number(id);
    if (!Number.isInteger(contactId) || contactId <= 0) {
      return NextResponse.json({ error: "Invalid contact id" }, { status: 400 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        name: true,
        title: true,
        email: true,
        phone: true,
        school: { select: { ncessch: true, schoolName: true, schoolLevel: true } },
        district: {
          select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true },
        },
      },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const [leads, activityCount, activities] = await Promise.all([
      prisma.lead.findMany({
        where: { contactId },
        select: {
          id: true,
          status: true,
          score: true,
          leadType: true,
          unqualifiedReason: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activity.count({
        where: {
          ...ENGAGEMENT_SOURCE_FILTER,
          contacts: { some: { contactId } },
        },
      }),
      prisma.activity.findMany({
        where: {
          ...ENGAGEMENT_SOURCE_FILTER,
          contacts: { some: { contactId } },
        },
        select: ENGAGEMENT_ACTIVITY_SELECT,
        orderBy: { startDate: "desc" },
        take: RECORD_TIMELINE_LIMIT,
      }),
    ]);

    // The contact's lead: an active one if it exists, else the most recent.
    const lead =
      leads.find((l) =>
        (ACTIVE_LEAD_STATUSES as readonly string[]).includes(l.status),
      ) ??
      leads[0] ??
      null;

    return NextResponse.json({
      contact: {
        id: contact.id,
        name: contact.name,
        title: contact.title,
        email: contact.email,
        phone: contact.phone,
      },
      school: contact.school
        ? { ncessch: contact.school.ncessch, name: contact.school.schoolName }
        : null,
      district: contact.district
        ? {
            leaid: contact.district.leaid,
            name: contact.district.name,
            city: contact.district.cityLocation,
            stateAbbrev: contact.district.stateAbbrev,
          }
        : null,
      lead,
      stats: {
        activities: activityCount,
        points: leads.reduce((sum, l) => sum + l.score, 0),
      },
      // All items are the contact's own activity — unlabeled in the UI.
      items: sortTimelineDesc(
        activities.map((a) => toEngagementItem(a, "own_contact", null)),
      ),
    });
  } catch (error) {
    console.error("Error fetching contact record:", error);
    return NextResponse.json({ error: "Failed to fetch contact record" }, { status: 500 });
  }
}
