import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import {
  ENGAGEMENT_ACTIVITY_SELECT,
  ENGAGEMENT_SOURCE_FILTER,
  attributeActivity,
  sortTimelineDesc,
  toEngagementItem,
  toLifecycleItem,
  type TimelineItem,
} from "@/features/leads/lib/server/timeline-items";

export const dynamic = "force-dynamic";

// GET /api/leads/[id]/timeline — merged lifecycle events + shared engagement
// activities touching the lead's contact, school, or district. Attribution
// (own_contact | other_contact | district_wide) lets the UI flag non-obvious
// sources; serialization is shared with the record-panel routes (see
// lib/server/timeline-items.ts).
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

    const lead = await prisma.lead.findUnique({
      where: { id },
      select: { id: true, contactId: true, leaid: true, schoolNcessch: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const [events, activities] = await Promise.all([
      prisma.leadEvent.findMany({
        where: { leadId: id },
        orderBy: { createdAt: "desc" },
      }),
      prisma.activity.findMany({
        where: {
          ...ENGAGEMENT_SOURCE_FILTER,
          OR: [
            { contacts: { some: { contactId: lead.contactId } } },
            { districts: { some: { districtLeaid: lead.leaid } } },
            ...(lead.schoolNcessch
              ? [{ schools: { some: { ncessch: lead.schoolNcessch } } }]
              : []),
          ],
        },
        select: ENGAGEMENT_ACTIVITY_SELECT,
        orderBy: { startDate: "desc" },
      }),
    ]);

    const items: TimelineItem[] = sortTimelineDesc([
      ...events.map(toLifecycleItem),
      ...activities.map((a) => {
        const { attribution, attributionName } = attributeActivity(a, lead.contactId);
        return toEngagementItem(a, attribution, attributionName);
      }),
    ]);

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching lead timeline:", error);
    return NextResponse.json({ error: "Failed to fetch lead timeline" }, { status: 500 });
  }
}
