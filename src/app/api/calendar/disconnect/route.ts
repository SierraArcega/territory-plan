// POST /api/calendar/disconnect — Removes the Google Calendar connection
// Deletes the stored tokens, the calendar connection record, and pending
// calendar events. Does NOT delete activities that were already created
// from calendar events.

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

    // Find either half of the connection (UserIntegration or CalendarConnection).
    // If neither exists, there's nothing to disconnect.
    const [integration, calendarConnection] = await Promise.all([
      prisma.userIntegration.findUnique({
        where: { userId_service: { userId: user.id, service: "google_calendar" } },
      }),
      prisma.calendarConnection.findUnique({
        where: { userId: user.id },
      }),
    ]);

    if (!integration && !calendarConnection) {
      return NextResponse.json(
        { error: "No calendar connection found" },
        { status: 404 }
      );
    }

    // Delete pending calendar events, the CalendarConnection (which cascades
    // any remaining CalendarEvent rows via onDelete: Cascade), and the
    // UserIntegration — all in one transaction so partial failures leave
    // nothing half-disconnected.
    await prisma.$transaction([
      prisma.calendarEvent.deleteMany({
        where: { userId: user.id, status: "pending" },
      }),
      ...(calendarConnection
        ? [prisma.calendarConnection.delete({ where: { userId: user.id } })]
        : []),
      ...(integration
        ? [
            prisma.userIntegration.delete({
              where: {
                userId_service: { userId: user.id, service: "google_calendar" },
              },
            }),
          ]
        : []),
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
