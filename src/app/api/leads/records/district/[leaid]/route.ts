import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  ENGAGEMENT_ACTIVITY_SELECT,
  ENGAGEMENT_SOURCE_FILTER,
  toEngagementItem,
} from "@/features/leads/lib/server/timeline-items";
import {
  RECORD_LIST_LIMIT,
  RECORD_TIMELINE_LIMIT,
  countActivitiesByContact,
  countActivitiesBySchool,
  pickLeadStatus,
} from "@/features/leads/lib/server/record-helpers";
import { SCHOOL_LEVEL_LABELS } from "@/features/shared/lib/schoolLabels";

export const dynamic = "force-dynamic";

// GET /api/leads/records/district/[leaid] — District record panel aggregate:
// account header, engaged schools (a district can hold dozens of schools, so
// only ones with contacts/activity/leads are listed), contacts, leads, stats,
// and the account activity timeline.
// "Points" = sum of lead scores in the district (see lib/server/record-helpers.ts).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ leaid: string }> },
) {
  try {
    const { leaid } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const district = await prisma.district.findUnique({
      where: { leaid },
      select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true },
    });
    if (!district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    const [schools, contacts, contactCount, leads, leadCount, leadAgg, activities] =
      await Promise.all([
        // Engaged schools only — districts can hold dozens of school rows;
        // the panel mirrors the prototype, which lists schools that hold a
        // contact, an activity, or a lead.
        prisma.school.findMany({
          where: {
            leaid,
            OR: [
              { workplaceContacts: { some: {} } },
              { activityLinks: { some: {} } },
              { leads: { some: {} } },
            ],
          },
          select: {
            ncessch: true,
            schoolName: true,
            schoolLevel: true,
            _count: { select: { workplaceContacts: true } },
          },
          orderBy: { schoolName: "asc" },
          take: RECORD_LIST_LIMIT,
        }),
        prisma.contact.findMany({
          where: { leaid },
          select: {
            id: true,
            name: true,
            title: true,
            school: { select: { schoolName: true } },
            leads: {
              select: { id: true, status: true },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { name: "asc" },
          take: RECORD_LIST_LIMIT,
        }),
        prisma.contact.count({ where: { leaid } }),
        prisma.lead.findMany({
          where: { leaid },
          select: {
            id: true,
            status: true,
            score: true,
            leadType: true,
            contact: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: RECORD_LIST_LIMIT,
        }),
        prisma.lead.count({ where: { leaid } }),
        prisma.lead.aggregate({ where: { leaid }, _sum: { score: true } }),
        prisma.activity.findMany({
          where: {
            ...ENGAGEMENT_SOURCE_FILTER,
            districts: { some: { districtLeaid: leaid } },
          },
          select: ENGAGEMENT_ACTIVITY_SELECT,
          orderBy: { startDate: "desc" },
          take: RECORD_TIMELINE_LIMIT,
        }),
      ]);

    const [activityCountByContact, activityCountBySchool] = await Promise.all([
      countActivitiesByContact(contacts.map((c) => c.id)),
      countActivitiesBySchool(schools.map((s) => s.ncessch)),
    ]);

    return NextResponse.json({
      district: {
        leaid: district.leaid,
        name: district.name,
        city: district.cityLocation,
        stateAbbrev: district.stateAbbrev,
      },
      stats: {
        schools: schools.length,
        contacts: contactCount,
        leads: leadCount,
        points: leadAgg._sum.score ?? 0,
      },
      schools: schools.map((s) => ({
        ncessch: s.ncessch,
        name: s.schoolName,
        level:
          s.schoolLevel != null ? (SCHOOL_LEVEL_LABELS[s.schoolLevel] ?? null) : null,
        contactCount: s._count.workplaceContacts,
        activityCount: activityCountBySchool.get(s.ncessch) ?? 0,
      })),
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        schoolName: c.school?.schoolName ?? null,
        leadStatus: pickLeadStatus(c.leads),
        activityCount: activityCountByContact.get(c.id) ?? 0,
      })),
      leads: leads.map((l) => ({
        id: l.id,
        status: l.status,
        score: l.score,
        leadType: l.leadType,
        contactName: l.contact?.name ?? null,
      })),
      // No single "own" contact viewpoint on a district record: contact-linked
      // activities show that contact's name; the rest are district-wide.
      items: activities.map((a) =>
        a.contacts.length > 0
          ? toEngagementItem(a, "other_contact", a.contacts[0].contact.name)
          : toEngagementItem(a, "district_wide", null),
      ),
    });
  } catch (error) {
    console.error("Error fetching district record:", error);
    return NextResponse.json({ error: "Failed to fetch district record" }, { status: 500 });
  }
}
