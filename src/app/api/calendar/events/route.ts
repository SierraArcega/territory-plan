// GET /api/calendar/events — Lists calendar events in the inbox
// Supports filtering by status (pending/confirmed/dismissed/cancelled)
// Returns events enriched with suggested district/contact/plan names for display

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status"); // pending, confirmed, dismissed, cancelled
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
    const where: Record<string, unknown> = { userId: user.id };
    if (status) {
      where.status = status;
    } else {
      // Default: show pending events (the inbox)
      where.status = "pending";
    }

    // Fetch events
    const [events, total, pendingCount] = await Promise.all([
      prisma.calendarEvent.findMany({
        where,
        orderBy: [
          // High confidence first, then by start time
          { matchConfidence: "asc" }, // "high" < "low" < "medium" < "none" alphabetically — we'll sort in JS
          { startTime: "asc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.calendarEvent.count({ where }),
      prisma.calendarEvent.count({
        where: { userId: user.id, status: "pending" },
      }),
    ]);

    // Enrich events with district/contact/plan names for display
    // Collect all IDs we need to look up
    const districtIds = new Set<string>();
    const contactIds = new Set<number>();
    const planIds = new Set<string>();

    for (const event of events) {
      if (event.suggestedDistrictId) districtIds.add(event.suggestedDistrictId);
      if (event.suggestedPlanId) planIds.add(event.suggestedPlanId);
      const cIds = event.suggestedContactIds as number[] | null;
      if (cIds) cIds.forEach((id) => contactIds.add(id));
    }

    // Batch fetch names
    const [districts, contacts, plans] = await Promise.all([
      districtIds.size > 0
        ? prisma.district.findMany({
            where: { leaid: { in: [...districtIds] } },
            select: { leaid: true, name: true, stateAbbrev: true },
          })
        : [],
      contactIds.size > 0
        ? prisma.contact.findMany({
            where: { id: { in: [...contactIds] } },
            select: { id: true, name: true, title: true, email: true },
          })
        : [],
      planIds.size > 0
        ? prisma.territoryPlan.findMany({
            where: { id: { in: [...planIds] } },
            select: { id: true, name: true, color: true },
          })
        : [],
    ]);

    // Build lookup maps
    const districtMap = new Map(districts.map((d) => [d.leaid, d]));
    const contactMap = new Map(contacts.map((c) => [c.id, c]));
    const planMap = new Map(plans.map((p) => [p.id, p]));

    // Enrich and sort events (high confidence first)
    const confidenceOrder: Record<string, number> = { high: 0, medium: 1, low: 2, none: 3 };
    const enrichedEvents = events
      .map((event) => {
        const district = event.suggestedDistrictId
          ? districtMap.get(event.suggestedDistrictId)
          : null;
        const plan = event.suggestedPlanId
          ? planMap.get(event.suggestedPlanId)
          : null;
        const cIds = (event.suggestedContactIds as number[] | null) || [];
        const suggestedContacts = cIds
          .map((id) => contactMap.get(id))
          .filter(Boolean);

        return {
          id: event.id,
          googleEventId: event.googleEventId,
          title: event.title,
          description: event.description,
          startTime: event.startTime.toISOString(),
          endTime: event.endTime.toISOString(),
          location: event.location,
          attendees: event.attendees,
          status: event.status,
          suggestedActivityType: event.suggestedActivityType,
          suggestedDistrictId: event.suggestedDistrictId,
          suggestedDistrictName: district?.name || null,
          suggestedDistrictState: district?.stateAbbrev || null,
          suggestedContactIds: cIds,
          suggestedContacts,
          suggestedPlanId: event.suggestedPlanId,
          suggestedPlanName: plan?.name || null,
          suggestedPlanColor: plan?.color || null,
          matchConfidence: event.matchConfidence,
          activityId: event.activityId,
          lastSyncedAt: event.lastSyncedAt.toISOString(),
        };
      })
      .sort(
        (a, b) =>
          (confidenceOrder[a.matchConfidence] ?? 3) -
          (confidenceOrder[b.matchConfidence] ?? 3)
      );

    return NextResponse.json({
      events: enrichedEvents,
      total,
      pendingCount,
    });
  } catch (error) {
    console.error("Calendar events list error:", error);
    return NextResponse.json(
      { error: "Failed to fetch calendar events" },
      { status: 500 }
    );
  }
}
