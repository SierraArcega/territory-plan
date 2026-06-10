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
  pickLeadStatus,
} from "@/features/leads/lib/server/record-helpers";
import { SCHOOL_LEVEL_LABELS } from "@/features/shared/lib/schoolLabels";

export const dynamic = "force-dynamic";

// GET /api/leads/records/school/[ncessch] — School record panel aggregate:
// school + parent district, contacts working at the school (with lead status
// and activity counts), engagement stats, and the school activity timeline.
// "Points" = sum of lead scores at this school (see lib/server/record-helpers.ts).
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ ncessch: string }> },
) {
  try {
    const { ncessch } = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const school = await prisma.school.findUnique({
      where: { ncessch },
      select: {
        ncessch: true,
        schoolName: true,
        schoolLevel: true,
        district: {
          select: { leaid: true, name: true, cityLocation: true, stateAbbrev: true },
        },
      },
    });
    if (!school) {
      return NextResponse.json({ error: "School not found" }, { status: 404 });
    }

    const [contacts, contactCount, activityCount, activities, leadAgg] =
      await Promise.all([
        prisma.contact.findMany({
          where: { schoolNcessch: ncessch },
          select: {
            id: true,
            name: true,
            title: true,
            leads: {
              select: { id: true, status: true },
              orderBy: { createdAt: "desc" },
            },
          },
          orderBy: { name: "asc" },
          take: RECORD_LIST_LIMIT,
        }),
        prisma.contact.count({ where: { schoolNcessch: ncessch } }),
        prisma.activity.count({
          where: { ...ENGAGEMENT_SOURCE_FILTER, schools: { some: { ncessch } } },
        }),
        prisma.activity.findMany({
          where: { ...ENGAGEMENT_SOURCE_FILTER, schools: { some: { ncessch } } },
          select: ENGAGEMENT_ACTIVITY_SELECT,
          orderBy: { startDate: "desc" },
          take: RECORD_TIMELINE_LIMIT,
        }),
        prisma.lead.aggregate({
          where: { schoolNcessch: ncessch },
          _sum: { score: true },
        }),
      ]);

    const activityCountByContact = await countActivitiesByContact(
      contacts.map((c) => c.id),
    );

    return NextResponse.json({
      school: {
        ncessch: school.ncessch,
        name: school.schoolName,
        level:
          school.schoolLevel != null
            ? (SCHOOL_LEVEL_LABELS[school.schoolLevel] ?? null)
            : null,
      },
      district: school.district
        ? {
            leaid: school.district.leaid,
            name: school.district.name,
            city: school.district.cityLocation,
            stateAbbrev: school.district.stateAbbrev,
          }
        : null,
      stats: {
        contacts: contactCount,
        activities: activityCount,
        points: leadAgg._sum.score ?? 0,
      },
      contacts: contacts.map((c) => ({
        id: c.id,
        name: c.name,
        title: c.title,
        leadStatus: pickLeadStatus(c.leads),
        activityCount: activityCountByContact.get(c.id) ?? 0,
      })),
      // No single "own" contact viewpoint on a school record: contact-linked
      // activities show that contact's name; the rest are school-wide signals.
      items: activities.map((a) =>
        a.contacts.length > 0
          ? toEngagementItem(a, "other_contact", a.contacts[0].contact.name)
          : toEngagementItem(a, "district_wide", "School-wide"),
      ),
    });
  } catch (error) {
    console.error("Error fetching school record:", error);
    return NextResponse.json({ error: "Failed to fetch school record" }, { status: 500 });
  }
}
