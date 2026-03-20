// POST /api/calendar/disconnect — Removes the Google Calendar connection
// Deletes the stored tokens and all pending calendar events
// Does NOT delete activities that were already created from calendar events

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

    // Find the integration to delete
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "google_calendar" } },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    // Delete pending calendar events for this user and then the integration
    // (CalendarEvent no longer cascades from the integration, so clean up manually)
    await prisma.$transaction([
      prisma.calendarEvent.deleteMany({
        where: { userId: user.id, status: "pending" },
      }),
      prisma.userIntegration.delete({
        where: { userId_service: { userId: user.id, service: "google_calendar" } },
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
