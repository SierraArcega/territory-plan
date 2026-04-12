// POST /api/calendar/disconnect — Removes the Google Calendar connection
// Deletes the stored tokens and pending calendar events. Does NOT delete
// activities that were already created from calendar events.

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    // Preserve dismissed/confirmed CalendarEvent rows so the user's prior
    // triage decisions survive a disconnect→reconnect cycle. The sync engine
    // dedupes by (userId, googleEventId) and will skip any event the user
    // already handled — but only if the row still exists. Detach them from
    // the integration (set connection_id = NULL) so the CASCADE DELETE on
    // UserIntegration doesn't destroy them.
    //
    // Pending rows are throwaway — delete them outright.
    await prisma.$transaction([
      // 1. Detach non-pending rows so they survive the cascade
      prisma.calendarEvent.updateMany({
        where: { userId: user.id, status: { not: "pending" } },
        data: { connectionId: null },
      }),
      // 2. Delete pending rows (inbox clutter the user hasn't acted on)
      prisma.calendarEvent.deleteMany({
        where: { userId: user.id, status: "pending" },
      }),
      // 3. Delete the integration (cascade now only hits rows still linked — none)
      prisma.userIntegration.delete({
        where: {
          userId_service: { userId: user.id, service: "google_calendar" },
        },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Calendar disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect calendar" },
      { status: 500 }
    );
  }
}
