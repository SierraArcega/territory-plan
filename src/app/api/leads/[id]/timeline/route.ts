import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Engagement items are attributed so the UI can flag the non-obvious ones:
 *  - own_contact:   touches the lead's own contact (left unlabeled in the UI)
 *  - other_contact: a sibling contact in the account (shows that name)
 *  - district_wide: no contact at all (district/school-level signal)
 */
type Attribution = "own_contact" | "other_contact" | "district_wide";

// GET /api/leads/[id]/timeline — merged lifecycle events + shared engagement
// activities touching the lead's contact, school, or district.
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
          source: { not: "system" },
          OR: [
            { contacts: { some: { contactId: lead.contactId } } },
            { districts: { some: { districtLeaid: lead.leaid } } },
            ...(lead.schoolNcessch
              ? [{ schools: { some: { ncessch: lead.schoolNcessch } } }]
              : []),
          ],
        },
        select: {
          id: true,
          type: true,
          title: true,
          notes: true,
          outcome: true,
          outcomeType: true,
          source: true,
          startDate: true,
          createdAt: true,
          createdByUserId: true,
          contacts: {
            select: { contactId: true, contact: { select: { name: true } } },
          },
        },
        orderBy: { startDate: "desc" },
      }),
    ]);

    const items = [
      ...events.map((e) => ({
        itemType: "lifecycle" as const,
        id: e.id,
        kind: e.kind,
        payload: e.payload,
        actorId: e.actorId,
        ts: e.createdAt.toISOString(),
      })),
      ...activities.map((a) => {
        let attribution: Attribution;
        let attributionName: string | null = null;
        if (a.contacts.some((c) => c.contactId === lead.contactId)) {
          attribution = "own_contact";
        } else if (a.contacts.length > 0) {
          attribution = "other_contact";
          attributionName = a.contacts[0].contact.name;
        } else {
          attribution = "district_wide";
        }
        return {
          itemType: "engagement" as const,
          id: a.id,
          type: a.type,
          title: a.title,
          notes: a.notes,
          outcome: a.outcome,
          outcomeType: a.outcomeType,
          source: a.source,
          createdByUserId: a.createdByUserId,
          attribution,
          attributionName,
          ts: (a.startDate ?? a.createdAt).toISOString(),
        };
      }),
    ].sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Error fetching lead timeline:", error);
    return NextResponse.json({ error: "Failed to fetch lead timeline" }, { status: 500 });
  }
}
